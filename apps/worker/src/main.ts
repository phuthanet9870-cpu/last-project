/**
 * Background worker (§60): BullMQ repeatable jobs with DB-enforced idempotency (job_key unique per scope/period).
 * Jobs: daily reset marker, ledger reconciliation (balanced tx + wallet snapshot vs ledger sums), chat retention cleanup, stale session cleanup.
 */
import { Queue, Worker } from 'bullmq';
import pg from 'pg';
const DB = process.env.DATABASE_URL ?? 'postgres://hb:hb_dev_pw@localhost:5432/hearthbound';
const REDIS = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
const connection = { host: REDIS.hostname, port: Number(REDIS.port || 6379) };
const pool = new pg.Pool({ connectionString: DB, max: 4 });
const bangkokDay = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** Each job records (job_key) once; a retry or a duplicate scheduler run becomes a no-op (idempotency by DB unique key, not by lock). */
async function once(kind: string, period: string, fn: () => Promise<unknown>) {
  const key = `${kind}:${period}`;
  const ins = await pool.query(`INSERT INTO scheduled_jobs(job_key,kind,period,status) VALUES ($1,$2,$3,'running') ON CONFLICT (job_key) DO NOTHING RETURNING job_key`, [key, kind, period]);
  if (ins.rowCount === 0) return { skipped: true, key };
  try { const result = await fn(); await pool.query(`UPDATE scheduled_jobs SET status='done', result=$2 WHERE job_key=$1`, [key, JSON.stringify(result ?? {})]); return { key, result }; }
  catch (e: any) { await pool.query(`DELETE FROM scheduled_jobs WHERE job_key=$1`, [key]); throw e; } // allow BullMQ retry
}
export const JOBS: Record<string, () => Promise<unknown>> = {
  dailyReset: () => once('daily_reset', bangkokDay(), async () => ({ note: 'Daily counters reset lazily per character on next login using Asia/Bangkok day keys (PlayerService.resetDailyIfNeeded).', day: bangkokDay() })),
  reconcileLedger: () => once('reconcile', new Date().toISOString().slice(0, 13), async () => {
    const unbalanced = (await pool.query('SELECT tx_id, currency, sum(amount)::text AS s FROM currency_ledger GROUP BY tx_id, currency HAVING sum(amount)<>0 LIMIT 50')).rows;
    const mismatch = (await pool.query(`SELECT w.account, w.currency, w.available::text AS wallet, COALESCE(l.s,0)::text AS ledger FROM wallets w LEFT JOIN (SELECT account, currency, sum(amount) s FROM currency_ledger GROUP BY account, currency) l ON l.account=w.account AND l.currency=w.currency WHERE w.account NOT LIKE 'system:%' AND (w.available + w.reserved) <> COALESCE(l.s,0) LIMIT 50`)).rows;
    if (unbalanced.length || mismatch.length) await pool.query(`INSERT INTO security_events(kind,detail) VALUES ('ledger_mismatch',$1)`, [JSON.stringify({ unbalanced, mismatch })]);
    return { unbalanced: unbalanced.length, mismatch: mismatch.length };
  }),
  chatRetention: () => once('chat_retention', bangkokDay(), async () => ({ deleted: (await pool.query(`DELETE FROM chat_messages WHERE at < now() - interval '30 days'`)).rowCount })),
  sessionCleanup: () => once('session_cleanup', bangkokDay(), async () => ({ deleted: (await pool.query(`DELETE FROM account_sessions WHERE expires_at < now() - interval '7 days'`)).rowCount })),
};
if (process.argv.includes('--once')) { // run all jobs once (used by tests / cron fallback without Redis)
  for (const [n, f] of Object.entries(JOBS)) console.log(n, JSON.stringify(await f()));
  await pool.end(); process.exit(0);
}
const q = new Queue('hearthbound', { connection });
await q.upsertJobScheduler('daily', { pattern: '1 0 * * *', tz: 'Asia/Bangkok' }, { name: 'dailyReset' });
await q.upsertJobScheduler('reconcile', { every: 60 * 60_000 }, { name: 'reconcileLedger' });
await q.upsertJobScheduler('chat', { pattern: '17 3 * * *', tz: 'Asia/Bangkok' }, { name: 'chatRetention' });
await q.upsertJobScheduler('sessions', { pattern: '27 3 * * *', tz: 'Asia/Bangkok' }, { name: 'sessionCleanup' });
new Worker('hearthbound', async (job) => { const fn = JOBS[job.name]; if (!fn) throw new Error(`unknown job ${job.name}`); return fn(); }, { connection, concurrency: 1 })
  .on('completed', (j, r) => console.log(`[worker] ${j.name} →`, JSON.stringify(r))).on('failed', (j, e) => console.error(`[worker] ${j?.name} failed`, e.message));
console.log('[worker] Hearthbound worker running (BullMQ) — schedules: daily 00:01 Asia/Bangkok, hourly ledger reconcile');
