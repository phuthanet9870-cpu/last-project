// Browser E2E of ONLINE mode: two real browser clients against a running game server (served at SERVER, default http://localhost:2567).
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(new URL('.', import.meta.url).pathname, '../..');
const SHOTS = resolve(root, 'tests/e2e/screenshots'); mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.SERVER ?? 'http://localhost:2567'; const tag = Math.random().toString(36).slice(2, 6); const out = []; const errors = [];
const b = await chromium.launch();
async function player(name) {
  const pg = await b.newPage({ viewport: { width: 1200, height: 740 } }); pg.on('pageerror', (e) => errors.push(`${name}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${name} console: ${m.text()}`); }); // CSP violations surface as console errors
  await pg.goto(BASE + '/'); await pg.click('text=Online Mode'); const inputs = await pg.$$('.panel-box input');
  await inputs[2].fill(`${name}_${tag}`); await inputs[3].fill('hunter2hunter2'); await pg.click('button:has-text("Register")');
  await pg.waitForSelector('text=Server characters'); await pg.fill('input[placeholder="Character name"]', `${name}${tag}`); await pg.click('button:has-text("Create character")');
  await pg.click('button:has-text("Enter world")'); await pg.waitForSelector('canvas.game'); await pg.waitForTimeout(1200); return pg;
}
try {
  const p1 = await player('Ivy'); const p2 = await player('Oak');
  await p1.waitForTimeout(800);
  const seen = await p1.evaluate(() => window.__hb.a.entities().filter((e) => e.k === 'player').map((e) => e.n));
  out.push({ name: 'two browser clients see each other in online mode', ok: seen.length >= 2, detail: JSON.stringify(seen) });
  await p2.keyboard.down('s'); await p2.waitForTimeout(700); await p2.keyboard.up('s'); await p1.waitForTimeout(400);
  await p1.keyboard.press('Enter'); await p1.keyboard.type('hello from Ivy'); await p1.keyboard.press('Enter'); await p2.waitForTimeout(600);
  const got = await p2.textContent('.chat-log'); out.push({ name: 'chat between browsers', ok: /hello from Ivy/.test(got), detail: '' });
  await p1.screenshot({ path: `${SHOTS}/online_p1.png` }); await p2.screenshot({ path: `${SHOTS}/online_p2.png` });
  const dev = await p1.evaluate(() => window.__hb.cmd('dev', { op: 'gold', n: 1e9 })); out.push({ name: 'dev/cheat commands rejected by server', ok: !dev.ok && dev.err === 'FORBIDDEN', detail: dev.err });
} catch (e) { out.push({ name: 'online flow', ok: false, detail: String(e.message) }); }
for (const r of out) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name} ${r.detail}`);
writeFileSync(resolve(root, 'tests/e2e/online-last-run.json'), JSON.stringify({ when: new Date().toISOString(), results: out, errors }, null, 2));
console.log(errors.length ? errors.join('\n') : 'no browser errors'); await b.close(); process.exit(out.every((r) => r.ok) && !errors.length ? 0 : 1);
