/** Production entry for the bundled build (dist/server.mjs): starts the server; graceful shutdown is wired in startServer. */
import { startServer } from './main.js';
startServer().catch((e) => { console.error(e); process.exit(1); });
