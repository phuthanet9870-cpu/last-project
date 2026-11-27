#!/usr/bin/env node
/** Bundles the game server and worker into dist/*.mjs (npm packages stay external) so production needs only runtime dependencies — no tsx/TypeScript. */
import { build } from 'esbuild';
const common = { bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external', sourcemap: true, logLevel: 'info', banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } };
await build({ ...common, entryPoints: ['apps/game-server/src/prod.ts'], outfile: 'dist/server.mjs' });
await build({ ...common, entryPoints: ['apps/worker/src/main.ts'], outfile: 'dist/worker.mjs' });
console.log('built dist/server.mjs, dist/worker.mjs');
