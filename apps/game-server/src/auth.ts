/** Authentication (§05): Argon2id password hashing, short-lived HMAC access tokens, rotating hashed refresh tokens, brute-force lockout. */
import { hash, verify } from '@node-rs/argon2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { pool, tx } from './db.js';
import { CONFIG } from './env.js';
import { newSecret, openSecret, otpauthUrl, sealSecret, verifyTotp } from './totp.js';

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');
export function signAccess(accountId: string, role: string, mfa = false): string {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ sub: accountId, role, mfa, exp: Math.floor(Date.now() / 1000) + CONFIG.accessTtlSec, iat: Math.floor(Date.now() / 1000) }));
  const sig = b64(createHmac('sha256', CONFIG.jwtSecret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
export function verifyAccess(token: string | undefined): { sub: string; role: string; mfa: boolean } | null {
  if (!token) return null; const [h, b, s] = token.split('.'); if (!h || !b || !s) return null;
  const exp = createHmac('sha256', CONFIG.jwtSecret).update(`${h}.${b}`).digest();
  const got = Buffer.from(s, 'base64url'); if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;
  try { const o = JSON.parse(Buffer.from(b, 'base64url').toString()); if (o.exp < Date.now() / 1000) return null; return { sub: o.sub, role: o.role, mfa: o.mfa === true }; } catch { return null; }
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 }; // OWASP-recommended Argon2id baseline

export class AuthError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export async function register(username: string, password: string) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username ?? '')) throw new AuthError(400, 'Username must be 3–20 letters, numbers or _');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new AuthError(400, 'Password must be 8–128 characters');
  const id = `acc_${randomBytes(8).toString('hex')}`; const ph = await hash(password, ARGON);
  try { await pool.query('INSERT INTO accounts(id,username,password_hash,consent_terms_at) VALUES ($1,$2,$3,now())', [id, username.toLowerCase(), ph]); }
  catch (e: any) { if (e.code === '23505') throw new AuthError(409, 'Username already taken'); throw e; }
  return issue(id, 'player', undefined);
}
export async function login(username: string, password: string, ip?: string, otp?: string) {
  const r = await pool.query('SELECT * FROM accounts WHERE username=$1', [String(username ?? '').toLowerCase()]); const a = r.rows[0];
  const fail = async () => { await pool.query('INSERT INTO login_history(account_id,username,ok,ip) VALUES ($1,$2,false,$3)', [a?.id ?? null, username, ip ?? null]); if (a) await pool.query(`UPDATE accounts SET failed_logins=failed_logins+1, locked_until=CASE WHEN failed_logins+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1`, [a.id]); throw new AuthError(401, 'Invalid username or password'); };
  if (!a) { await hash('dummy-password-timing', ARGON); return fail(); }
  if (a.locked_until && new Date(a.locked_until) > new Date()) throw new AuthError(429, 'Too many failed attempts. Try again later.');
  if (!(await verify(a.password_hash, String(password ?? '')))) return fail();
  if (a.status !== 'active') throw new AuthError(403, `Account ${a.status}${a.ban_reason ? `: ${a.ban_reason}` : ''}`);
  let mfa = false;
  if (a.mfa_secret) { // second factor: TOTP code, one use per 30 s step (replay protection)
    if (!otp) throw Object.assign(new AuthError(401, 'MFA_REQUIRED'), { mfaRequired: true });
    const step = verifyTotp(openSecret(a.mfa_secret, CONFIG.mfaKey), String(otp)); if (step === null || step <= Number(a.mfa_last_step)) return fail();
    await pool.query('UPDATE accounts SET mfa_last_step=$2 WHERE id=$1', [a.id, step]); mfa = true;
  }
  await pool.query('UPDATE accounts SET failed_logins=0, locked_until=NULL, last_login_at=now() WHERE id=$1', [a.id]);
  await pool.query('INSERT INTO login_history(account_id,username,ok,ip) VALUES ($1,$2,true,$3)', [a.id, username, ip ?? null]);
  return issue(a.id, a.role, ip, mfa);
}
async function issue(accountId: string, role: string, ip?: string, mfa = false) {
  const refresh = randomBytes(32).toString('base64url'); const sid = `ses_${randomBytes(8).toString('hex')}`;
  await pool.query(`INSERT INTO account_sessions(id,account_id,refresh_hash,ip,expires_at,mfa) VALUES ($1,$2,$3,$4,now()+($5||' seconds')::interval,$6)`, [sid, accountId, sha(refresh), ip ?? null, String(CONFIG.refreshTtlSec), mfa]);
  return { accountId, role, mfa, accessToken: signAccess(accountId, role, mfa), refreshToken: refresh, expiresIn: CONFIG.accessTtlSec };
}
/** Refresh-token rotation with reuse detection: a reused (already rotated) token revokes the whole session family. */
export async function refresh(token: string) {
  return tx(async (c) => {
    const r = await c.query('SELECT s.*, a.role, a.status FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE refresh_hash=$1 FOR UPDATE', [sha(String(token ?? ''))]); const s = r.rows[0];
    if (!s) throw new AuthError(401, 'Invalid refresh token');
    if (s.revoked_at) { await c.query('UPDATE account_sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL', [s.account_id]); await c.query(`INSERT INTO security_events(kind,account_id,detail) VALUES ('refresh_reuse',$1,'{}')`, [s.account_id]); throw new AuthError(401, 'Refresh token reuse detected; all sessions revoked'); }
    if (new Date(s.expires_at) < new Date() || s.status !== 'active') throw new AuthError(401, 'Session expired');
    const nt = randomBytes(32).toString('base64url'); const sid = `ses_${randomBytes(8).toString('hex')}`;
    await c.query(`INSERT INTO account_sessions(id,account_id,refresh_hash,expires_at,mfa) VALUES ($1,$2,$3,now()+($4||' seconds')::interval,$5)`, [sid, s.account_id, sha(nt), String(CONFIG.refreshTtlSec), s.mfa]);
    await c.query('UPDATE account_sessions SET revoked_at=now(), replaced_by=$2 WHERE id=$1', [s.id, sid]);
    return { accountId: s.account_id, role: s.role, mfa: s.mfa, accessToken: signAccess(s.account_id, s.role, s.mfa), refreshToken: nt, expiresIn: CONFIG.accessTtlSec };
  });
}
export async function logout(token: string) { await pool.query('UPDATE account_sessions SET revoked_at=now() WHERE refresh_hash=$1', [sha(String(token ?? ''))]); }

/** MFA enrolment: setup stores an encrypted pending secret; enable verifies one code before activating. */
export async function mfaSetup(accountId: string) {
  const a = (await pool.query('SELECT username, mfa_secret FROM accounts WHERE id=$1', [accountId])).rows[0]; if (!a) throw new AuthError(404, 'No account'); if (a.mfa_secret) throw new AuthError(409, 'MFA already enabled');
  const secret = newSecret(); await pool.query('UPDATE accounts SET mfa_pending=$2 WHERE id=$1', [accountId, sealSecret(secret, CONFIG.mfaKey)]);
  return { secret, otpauthUrl: otpauthUrl(secret, a.username) };
}
export async function mfaEnable(accountId: string, code: string) {
  const a = (await pool.query('SELECT mfa_pending FROM accounts WHERE id=$1', [accountId])).rows[0]; if (!a?.mfa_pending) throw new AuthError(400, 'Run MFA setup first');
  const step = verifyTotp(openSecret(a.mfa_pending, CONFIG.mfaKey), String(code ?? '')); if (step === null) throw new AuthError(400, 'Invalid code');
  await pool.query('UPDATE accounts SET mfa_secret=mfa_pending, mfa_pending=NULL, mfa_enabled_at=now(), mfa_last_step=$2 WHERE id=$1', [accountId, step]);
  await pool.query('UPDATE account_sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL', [accountId]); // sign in again with the second factor
  await pool.query(`INSERT INTO security_events(kind,account_id,detail) VALUES ('mfa_enabled',$1,'{}')`, [accountId]); return { enabled: true };
}

/** Password check that does not require an active account (used by sanction appeals). Constant-ish timing for unknown users. */
export async function verifyCredentials(username: string, password: string): Promise<{ id: string; status: string } | null> {
  const a = (await pool.query('SELECT id, status, password_hash FROM accounts WHERE username=$1', [String(username ?? '').toLowerCase()])).rows[0];
  if (!a) { await hash('dummy-password-timing', ARGON); return null; } return (await verify(a.password_hash, String(password ?? ''))) ? { id: a.id, status: a.status } : null;
}
