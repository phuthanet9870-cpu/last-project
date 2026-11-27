/** Server configuration from environment variables (see .env.example). No secrets are hardcoded for production. */
import { randomBytes } from 'node:crypto';
const env = process.env;
const isProd = env.NODE_ENV === 'production';
if (isProd && !env.JWT_SECRET) throw new Error('JWT_SECRET is required in production');
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
  isProd,
};
