#!/usr/bin/env node
/**
 * Backup → restore drill (§64/§65). Dumps the live database with pg_dump (custom format), restores it into a
 * throw-away database, and verifies the copy: same migrations, same row counts for every table, same ledger
 * totals per currency, zero unbalanced transactions. Prints timings (RTO evidence) and writes a JSON report.
 *
 *   node scripts/backup-drill.mjs            # uses DATABASE_URL (default: local dev database)
 *   KEEP_DUMP=1 node scripts/backup-drill.mjs  # keep the .dump file in backups/
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.env.DATABASE_URL ?? 'postgres://hb:hb_dev_pw@localhost:5432/hearthbound';
const drillDb = `hb_restore_drill_${Date.now()}`;
const target = src.replace(/\/[^/?]+(\?|$)/, `/${drillDb}$1`);
const adminUrl = src.replace(/\/[^/?]+(\?|$)/, '/postgres$1');
mkdirSync(resolve(root, 'backups'), { recursive: true });
const dump = resolve(root, 'backups', `hearthbound_${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);

const snapshot = async (url) => {
  const c = new pg.Client({ connectionString: url }); await c.connect();
  const tables = (await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows.map((r) => r.tablename);
  const counts = {}; for (const t of tables) counts[t] = Number((await c.query(`SELECT count(*) FROM "${t}"`)).rows[0].count);
  const migrations = (await c.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map((r) => r.version);
  const ledger = Object.fromEntries((await c.query('SELECT currency, sum(amount)::text AS s FROM currency_ledger GROUP BY currency ORDER BY currency')).rows.map((r) => [r.currency, r.s]));
  const unbalanced = Number((await c.query('SELECT count(*) FROM (SELECT tx_id FROM currency_ledger GROUP BY tx_id, currency HAVING sum(amount)<>0) x')).rows[0].count);
  await c.end(); return { tables: tables.length, counts, migrations, ledger, unbalanced };
};

const t0 = Date.now();
const before = await snapshot(src);
execFileSync('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${dump}`, src], { stdio: 'inherit' });
const tDump = Date.now(); const size = statSync(dump).size;
const admin = new pg.Client({ connectionString: adminUrl }); await admin.connect(); await admin.query(`CREATE DATABASE "${drillDb}"`);
let report;
try {
  execFileSync('pg_restore', ['--no-owner', '--no-privileges', '--exit-on-error', `--dbname=${target}`, dump], { stdio: 'inherit' });
  const tRestore = Date.now(); const after = await snapshot(target);
  const diffs = Object.keys(before.counts).filter((t) => before.counts[t] !== after.counts[t]);
  const ok = diffs.length === 0 && JSON.stringify(before.migrations) === JSON.stringify(after.migrations) && JSON.stringify(before.ledger) === JSON.stringify(after.ledger) && after.unbalanced === 0;
  report = { when: new Date().toISOString(), ok, dumpBytes: size, dumpMs: tDump - t0, restoreMs: tRestore - tDump, totalMs: tRestore - t0, tables: after.tables, rows: Object.values(after.counts).reduce((a, b) => a + b, 0), migrations: after.migrations, ledgerTotals: after.ledger, unbalancedTx: after.unbalanced, rowCountMismatches: diffs };
} finally {
  await admin.query(`DROP DATABASE IF EXISTS "${drillDb}"`); await admin.end();
  if (process.env.KEEP_DUMP !== '1') unlinkSync(dump);
}
writeFileSync(resolve(root, 'docs/backup-drill-last.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2)); process.exit(report.ok ? 0 : 1);
