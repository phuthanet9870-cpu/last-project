/** Server configuration from environment variables (see .env.example). No secrets are hardcoded for production. */
import { randomBytes } from 'node:crypto';
const env = process.env;
const isProd = env.NODE_ENV === 'production';
/** Production refuses to start with unsafe settings (fail fast instead of running insecurely). */
export function productionProblems(e: NodeJS.ProcessEnv): string[] {
  const p: string[] = [];
  if (!e.JWT_SECRET || e.JWT_SECRET.length < 32 || /change-me|secret|dev/i.test(e.JWT_SECRET)) p.push('JWT_SECRET must be a random value of at least 32 characters');
  if (!e.DATABASE_URL || /hb_dev_pw/.test(e.DATABASE_URL)) p.push('DATABASE_URL must be set and must not use the development password');
  if (!e.CORS_ORIGIN || e.CORS_ORIGIN === '*') p.push('CORS_ORIGIN must list the real site origin(s), not *');
  if (e.DEV_COMMANDS === '1') p.push('DEV_COMMANDS must not be enabled in production');
  if (e.ADMIN_REQUIRE_MFA === '0') p.push('ADMIN_REQUIRE_MFA cannot be disabled in production');
  if (!e.MFA_ENC_KEY || e.MFA_ENC_KEY.length < 32) p.push('MFA_ENC_KEY (32+ chars) is required to encrypt admin TOTP secrets');
  return p;
}
if (isProd) { const probs = productionProblems(env); if (probs.length) throw new Error(`Refusing to start in production:\n - ${probs.join('\n - ')}`); }
export const CONFIG = {
  port: Number(env.PORT ?? 2567),
  host: env.HOST ?? '0.0.0.0',
  databaseUrl: env.DATABASE_URL ?? 'postgres://hb:hb_dev_pw@localhost:5432/hearthbound',
  redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: env.JWT_SECRET ?? randomBytes(32).toString('hex'), // dev: ephemeral per process
  accessTtlSec: 15 * 60, refreshTtlSec: 30 * 86400,
  worldId: env.WORLD_ID ?? 'w1',
  devCommands: env.DEV_COMMANDS === '1' && !isProd, // never in production
  tickHz: 20, snapshotHz: 10, saveIntervalMs: 30_000,
  corsOrigin: env.CORS_ORIGIN ?? '*',
  adminRequireMfa: isProd ? true : env.ADMIN_REQUIRE_MFA === '1', // always on in production
  mfaKey: env.MFA_ENC_KEY ?? env.JWT_SECRET ?? 'dev-only-mfa-key', trustProxy: env.TRUST_PROXY === '1', hsts: env.HSTS === '1' || isProd,
  isProd,
};
