/**
 * TOTP (RFC 6238 / RFC 4226) for admin MFA, implemented with node:crypto only.
 * Secrets are stored encrypted at rest (AES-256-GCM, key from MFA_ENC_KEY or derived from JWT_SECRET in dev).
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, ''); let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) { const i = B32.indexOf(ch); if (i < 0) throw new Error('invalid base32'); value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
/** HOTP value for a counter (RFC 4226 dynamic truncation). */
export function hotp(key: Buffer, counter: number, digits = 6, algo: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac(algo, key).update(msg).digest(); const off = h[h.length - 1]! & 0x0f;
  const bin = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(bin % 10 ** digits).padStart(digits, '0');
}
export const totpStep = (timeMs: number, period = 30) => Math.floor(timeMs / 1000 / period);
export function totp(secretB32: string, timeMs = Date.now(), digits = 6): string { return hotp(base32Decode(secretB32), totpStep(timeMs), digits); }
/** Accepts the current step ±window; returns the matched step (for replay protection) or null. Constant-time compare per candidate. */
export function verifyTotp(secretB32: string, code: string, timeMs = Date.now(), window = 1): number | null {
  if (!/^\d{6}$/.test(String(code ?? ''))) return null; const key = base32Decode(secretB32); const now = totpStep(timeMs); let hit: number | null = null;
  for (let w = -window; w <= window; w++) { const c = hotp(key, now + w); let diff = 0; for (let i = 0; i < 6; i++) diff |= c.charCodeAt(i) ^ code.charCodeAt(i); if (diff === 0 && hit === null) hit = now + w; }
  return hit;
}
export function newSecret(): string { return base32Encode(randomBytes(20)); }
export function otpauthUrl(secret: string, account: string, issuer = 'Hearthbound Online') { return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`; }

const keyFrom = (k: string) => createHash('sha256').update(`hb-mfa:${k}`).digest();
export function sealSecret(secret: string, key: string): string { const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', keyFrom(key), iv); const ct = Buffer.concat([c.update(secret, 'utf8'), c.final()]); return `v1.${iv.toString('base64url')}.${ct.toString('base64url')}.${c.getAuthTag().toString('base64url')}`; }
export function openSecret(sealed: string, key: string): string { const [v, iv, ct, tag] = sealed.split('.'); if (v !== 'v1' || !iv || !ct || !tag) throw new Error('bad sealed secret'); const d = createDecipheriv('aes-256-gcm', keyFrom(key), Buffer.from(iv, 'base64url')); d.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8'); }

/** Admin guard policy: admin/moderator routes need an MFA-verified session when the policy requires it. */
export function adminAllowed(claims: { role: string; mfa?: boolean }, requireMfa: boolean): { ok: true } | { ok: false; status: number; error: string } {
  if (claims.role !== 'admin' && claims.role !== 'moderator') return { ok: false, status: 403, error: 'Forbidden' };
  if (requireMfa && !claims.mfa) return { ok: false, status: 403, error: 'MFA_REQUIRED: sign in with your authenticator code to use admin tools' };
  return { ok: true };
}
