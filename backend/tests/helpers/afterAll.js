'use strict';

// Close the per-test-file connection pool so Jest exits cleanly.
afterAll(async () => {
  const { pool } = require('../../src/db/pool');
  await pool.end();
});
