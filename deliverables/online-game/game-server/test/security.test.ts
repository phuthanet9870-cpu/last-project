import { describe, expect, it } from 'vitest';
import { adminAllowed, base32Decode, base32Encode, hotp, openSecret, sealSecret, totp, totpStep, verifyTotp } from '../src/totp.js';
import { productionProblems } from '../src/env.js';

describe('TOTP (RFC 6238 / RFC 4226)', () => {
  const key = Buffer.from('12345678901234567890'); const b32 = base32Encode(key);
  it('matches the RFC 6238 SHA-1 test vectors (8 digits)', () => {
    for (const [t, code] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']] as const) expect(hotp(key, totpStep(t * 1000), 8)).toBe(code);
  });
  it('matches the RFC 4226 HOTP vectors and round-trips base32', () => {
    expect(['755224', '287082', '359152', '969429', '338314'].map((c, i) => hotp(key, i) === c).every(Boolean)).toBe(true); expect(base32Decode(b32).equals(key)).toBe(true); expect(b32).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });
  it('accepts ±1 step, rejects others and malformed codes', () => {
    const t = 1_800_000_000_000; const c = totp(b32, t); expect(verifyTotp(b32, c, t)).toBe(totpStep(t)); expect(verifyTotp(b32, c, t + 30_000)).toBe(totpStep(t)); expect(verifyTotp(b32, c, t + 90_000)).toBeNull();
    expect(verifyTotp(b32, '12345', t)).toBeNull(); expect(verifyTotp(b32, 'abcdef', t)).toBeNull();
  });
  it('encrypts secrets at rest (AES-256-GCM); a wrong key or tampering fails', () => {
    const sealed = sealSecret(b32, 'k'.repeat(40)); expect(sealed).not.toContain(b32); expect(openSecret(sealed, 'k'.repeat(40))).toBe(b32);
    expect(() => openSecret(sealed, 'x'.repeat(40))).toThrow(); const parts = sealed.split('.'); parts[2] = parts[2]!.slice(0, -2) + (parts[2]!.endsWith('A') ? 'BB' : 'AA'); expect(() => openSecret(parts.join('.'), 'k'.repeat(40))).toThrow();
  });
});
describe('admin guard + production config', () => {
  it('admin tools need the admin/moderator role and, when required, an MFA-verified session', () => {
    expect(adminAllowed({ role: 'player', mfa: true }, true).ok).toBe(false); expect(adminAllowed({ role: 'admin', mfa: false }, true)).toMatchObject({ ok: false, status: 403 });
    expect(adminAllowed({ role: 'admin', mfa: true }, true).ok).toBe(true); expect(adminAllowed({ role: 'moderator', mfa: false }, false).ok).toBe(true);
  });
  it('production refuses unsafe settings and accepts a hardened one', () => {
    expect(productionProblems({}).length).toBeGreaterThanOrEqual(4);
    expect(productionProblems({ JWT_SECRET: 'change-me-in-env', DATABASE_URL: 'postgres://hb:hb_dev_pw@x/db', CORS_ORIGIN: '*', DEV_COMMANDS: '1', MFA_ENC_KEY: 'short' }).length).toBe(5);
    expect(productionProblems({ JWT_SECRET: 'q8Zr2vN4xT7mL1pK9sB3wY6eH0cA5uJdFgQ', DATABASE_URL: 'postgres://hb:Str0ngRand0m@db/hb', CORS_ORIGIN: 'https://play.example.org', MFA_ENC_KEY: 'k3J9xP2mQ7vR4tY8wZ1aB6cD0eF5gH2iJ' })).toEqual([]);
  });
});
