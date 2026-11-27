// Builds the browser client into deliverables/playable-artifact (index.html + game.js + styles.css).
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'deliverables/playable-artifact');
mkdirSync(out, { recursive: true });
if (!existsSync(resolve(root, 'apps/game-client/src/registry.json'))) { await import('./gen-registry.mjs'); }
const opts = {
  entryPoints: [resolve(root, 'apps/game-client/src/main.ts')], bundle: true, format: 'iife', target: 'es2020', minify: !process.argv.includes('--serve'),
  outfile: resolve(out, 'game.js'), alias: { '@hb/game-core': resolve(root, 'packages/game-core/src/index.ts') }, loader: { '.json': 'json' }, legalComments: 'none', logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
};
copyFileSync(resolve(root, 'apps/game-client/index.html'), resolve(out, 'index.html'));
copyFileSync(resolve(root, 'apps/game-client/styles.css'), resolve(out, 'styles.css'));
if (process.argv.includes('--serve')) {
  const ctx = await esbuild.context(opts); await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: Number(process.env.PORT ?? 5173), host: '0.0.0.0' });
  console.log(`\n  Hearthbound client running → http://localhost:${port}/  (artifact/offline mode; add ?dev=0 to hide dev panel)\n`);
} else { const r = await esbuild.build(opts); console.log('built', r.errors.length ? 'with errors' : 'ok'); }
