'use strict';

/**
 * Loads the demo / test-plan dataset into DATABASE_URL (replaces existing data).
 * Usage: node scripts/db-seed.js [--students=300] [--faculty=20]
 */
const { Pool } = require('pg');
const config = require('../src/config');
const { seed } = require('../db/seed');

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
}

(async () => {
  const pool = new Pool({ connectionString: config.databaseUrl });
  try {
    await seed(pool, { students: arg('students', 300), faculty: arg('faculty', 20) });
  } catch (err) {
    console.error('[seed] failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
