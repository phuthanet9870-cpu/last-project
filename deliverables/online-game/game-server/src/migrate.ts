import { migrate, pool, seed } from './db.js';
const applied = await migrate(); await seed(); console.log(applied.length ? `applied: ${applied.join(', ')}` : 'database up to date'); await pool.end();
