import { pool, seed } from './db.js';
await seed(); console.log('seeded world w1 + feature flags'); await pool.end();
