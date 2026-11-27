// One-command local start: migrate DB, build client, start server (serves client + admin + WebSocket).
// Requires PostgreSQL + Redis reachable via DATABASE_URL / REDIS_URL (e.g. `docker compose up -d postgres redis`).
// Without a database, use the offline build instead: open deliverables/playable-artifact/index.html.
import { spawnSync, spawn } from 'node:child_process';
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' }); if (r.status !== 0) { console.error(`\n✖ ${cmd} ${args.join(' ')} failed.\n  Is PostgreSQL running? Try: docker compose up -d postgres redis\n  Offline play: open deliverables/playable-artifact/index.html\n`); process.exit(r.status ?? 1); } };
run('node', ['scripts/build-client.mjs']);
run('npx', ['tsx', 'apps/game-server/src/migrate.ts']);
const s = spawn('npx', ['tsx', 'apps/game-server/src/main.ts'], { stdio: 'inherit', shell: process.platform === 'win32' });
s.on('exit', (c) => process.exit(c ?? 0));
