/** Load test: N real WebSocket clients register, join, move and chat; reports server tick p95 from /api/health. Usage: tsx tests/load/load.ts 20 50 100 */
import WebSocket from 'ws';
import { writeFileSync, mkdirSync } from 'node:fs';
const BASE = process.env.SERVER ?? 'http://localhost:2567'; const WS = BASE.replace(/^http/, 'ws') + '/ws';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function client(i: number, tag: string) {
  const u = `ld${tag}${i}`; const r: any = await (await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: 'loadtest-pass' }) })).json();
  const c: any = await (await fetch(`${BASE}/api/characters`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${r.accessToken}` }, body: JSON.stringify({ name: `L${tag}${i}`, classId: 'vanguard' }) })).json();
  const ws = new WebSocket(`${WS}?token=${r.accessToken}&character=${c.character.id}`); let bytes = 0; let id = 0;
  await new Promise<void>((res, rej) => { ws.on('message', (d: Buffer) => { bytes += d.length; if (String(d).startsWith('{"type":"welcome"')) res(); }); ws.on('error', rej); });
  const send = (cmd: string, args: unknown) => ws.send(JSON.stringify({ type: 'cmd', id: ++id, cmd, args }));
  const timer = setInterval(() => { const a = Math.random() * Math.PI * 2; send('move', { dx: Math.cos(a), dy: Math.sin(a) }); if (Math.random() < 0.05) send('chat', { ch: 'local', msg: 'hi' }); }, 500);
  return { ws, timer, bytes: () => bytes };
}
const tiers = process.argv.slice(2).map(Number).filter(Boolean); const out: any[] = [];
for (const n of tiers.length ? tiers : [20, 50]) {
  const tag = Math.random().toString(36).slice(2, 5); const t0 = Date.now(); const cs = [];
  for (let i = 0; i < n; i++) cs.push(await client(i, tag));
  await sleep(10_000); const samples: number[] = []; const avgs: number[] = [];
  for (let k = 0; k < 10; k++) { const h: any = await (await fetch(`${BASE}/api/health`)).json(); samples.push(h.tickMsP95); avgs.push(h.tickMsAvg ?? 0); await sleep(1000); }
  const bytes = cs.reduce((s, c) => s + c.bytes(), 0); const secs = (Date.now() - t0) / 1000;
  const row = { clients: n, tickP95msMax: Math.max(...samples).toFixed(2), tickP95msMedian: samples.sort((a, b) => a - b)[5]!.toFixed(2), tickAvgMs: (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2), downKBpsPerClient: (bytes / secs / n / 1024).toFixed(1), rssMB: Math.round(process.memoryUsage().rss / 1e6) + ' (test process)' };
  console.log(row); out.push(row);
  for (const c of cs) { clearInterval(c.timer); c.ws.close(); } await sleep(2000);
}
mkdirSync('tests/load', { recursive: true }); writeFileSync('tests/load/last-run.json', JSON.stringify({ when: new Date().toISOString(), note: 'server + load generator share one 4-core dev container (CPU contention inflates tick times); all clients in the same town map; movement+chat workload only (no combat); visibility cap 40 nearest players', results: out }, null, 2));
process.exit(0);
