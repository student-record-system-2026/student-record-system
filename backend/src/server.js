'use strict';

const config = require('./config');
const { createApp } = require('./app');
const { pool } = require('./db/pool');

const app = createApp();

const server = app.listen(config.port, async () => {
  console.log(`[srs] API listening on http://localhost:${config.port}/api (${config.env})`);
  try {
    await pool.query('SELECT 1');
    console.log('[srs] database connection OK');
  } catch (err) {
    console.error('[srs] WARNING: cannot reach the database -', err.message);
    console.error('[srs] Check DATABASE_URL in backend/.env and run "npm run db:setup".');
  }
});

function shutdown() {
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
