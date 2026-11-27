import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG as ENV } from './env.js';

export const pool = new pg.Pool({ connectionString: ENV.databaseUrl, max: 10 });
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => undefined); throw e; } finally { c.release(); }
}
export async function migrate(): Promise<string[]> {
  const dir = process.env.APP_ROOT ? resolve(process.env.APP_ROOT, 'database/migrations') : resolve(dirname(fileURLToPath(import.meta.url)), '../../../database/migrations'); // APP_ROOT: bundled production build
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await pool.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    await tx(async (c) => { await c.query(readFileSync(resolve(dir, f), 'utf8')); await c.query('INSERT INTO schema_migrations(version) VALUES ($1)', [f]); });
    applied.push(f);
  }
  return applied;
}
export async function seed() {
  await pool.query(`INSERT INTO worlds(id,name,region) VALUES ('w1','Emberglen-1','asia') ON CONFLICT DO NOTHING`);
  for (const [k, v] of Object.entries({ realPayments: false, paidRandomRewards: false, raid: true, housing: true, breeding: false, guildWar: false, crossWorldTransfer: false, devPanel: false }))
    await pool.query('INSERT INTO feature_flags(key,enabled,updated_by) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING', [k, v, 'seed']);
}
