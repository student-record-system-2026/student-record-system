'use strict';

/**
 * Integration-test global setup: make sure the dedicated TEST database exists and has the
 * current schema. Never touches the development database.
 */
const path = require('path');
const { Client } = require('pg');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  const config = require('../../src/config');
  const { applySchema } = require('../../scripts/db-schema');

  const target = new URL(config.databaseUrl);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(config.databaseUrl);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  try {
    await client.connect();
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rows.length) await client.query(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    throw new Error(
      `Integration tests need PostgreSQL. Could not prepare test database "${dbName}": ${err.message}. ` +
        'Check TEST_DATABASE_URL in backend/.env.'
    );
  } finally {
    await client.end().catch(() => {});
  }
  await applySchema(config.databaseUrl);
};
