'use strict';

/**
 * Applies db/schema.sql (drops and recreates all tables) to DATABASE_URL,
 * or to TEST_DATABASE_URL when NODE_ENV=test.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const config = require('../src/config');

async function applySchema(connectionString = config.databaseUrl) {
  const sql = fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf8');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('SET client_min_messages TO WARNING');
    await client.query(sql);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  applySchema()
    .then(() => console.log(`[db] schema applied to ${new URL(config.databaseUrl).pathname.slice(1)}`))
    .catch((err) => {
      console.error('[db] schema failed:', err.message);
      process.exit(1);
    });
}

module.exports = { applySchema };
