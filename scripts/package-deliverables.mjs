// Assembles deliverables/ (playable-artifact, online-game, documentation) and builds releases/*.zip from real files.
import { cpSync, mkdirSync, rmSync, existsSync, copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const D = resolve(root, 'deliverables'); const R = resolve(root, 'releases');
execFileSync('node', [resolve(root, 'scripts/gen-registry.mjs')], { stdio: 'inherit' });
execFileSync('node', [resolve(root, 'scripts/build-client.mjs')], { stdio: 'inherit' });
// playable artifact README
copyFileSync(resolve(root, 'docs/PLAYABLE_README.md'), resolve(D, 'playable-artifact/README.md'));
// online-game: mirror of the runnable source tree pieces
const OG = resolve(D, 'online-game'); const outDir = OG; mkdirSync(OG, { recursive: true });
for (const [src, dst] of [['apps/game-client', 'game-client'], ['apps/game-server', 'game-server'], ['apps/admin-dashboard', 'admin-dashboard'], ['apps/worker', 'worker'], ['database', 'database'], ['packages/game-core', 'game-core']]) {
  const target = resolve(outDir, dst); if (existsSync(target)) rmSync(target, { recursive: true, force: true }); cpSync(resolve(root, src), target, { recursive: true });
}
const api = resolve(OG, 'api-server'); mkdirSync(api, { recursive: true });
writeFileSync(resolve(api, 'README.md'), '# api-server\n\nThe REST control plane (auth, characters, rankings, admin, payments stub) is implemented with Fastify **inside** `game-server/src/main.ts` (modular monolith, ADR-004). It shares the process with the WebSocket game loop. Routes: see `documentation/TECHNICAL_DESIGN_DOCUMENT.md`.\n');
for (const f of ['docker-compose.yml', '.env.example']) copyFileSync(resolve(root, f), resolve(OG, f));
copyFileSync(resolve(root, 'docs/ONLINE_README.md'), resolve(OG, 'README.md'));
// documentation
const DOC = resolve(D, 'documentation'); mkdirSync(DOC, { recursive: true });
copyFileSync(resolve(root, 'MASTER_PROMPT.md'), resolve(DOC, 'MASTER_PROMPT_MMORPG.md'));
for (const f of readdirSync(resolve(root, 'docs'))) if (f.endsWith('.md') && !['PLAYABLE_README.md', 'ONLINE_README.md'].includes(f)) copyFileSync(resolve(root, 'docs', f), resolve(DOC, f));
// releases
mkdirSync(R, { recursive: true });
for (const z of ['MMORPG_PLAYABLE.zip', 'MMORPG_SOURCE_CODE.zip']) if (existsSync(resolve(R, z))) rmSync(resolve(R, z));
execFileSync('zip', ['-qr', resolve(R, 'MMORPG_PLAYABLE.zip'), 'playable-artifact'], { cwd: D });
execFileSync('git', ['archive', '--format=zip', '-o', resolve(R, 'MMORPG_SOURCE_CODE.zip'), 'HEAD'], { cwd: root });
console.log('packaged:', readdirSync(R).join(', '), '(source zip = committed HEAD)');
