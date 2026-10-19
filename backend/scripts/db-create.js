'use strict';

/**
 * Creates the application database (and the test database) if they do not exist.
 * Connects to the server's default "postgres" maintenance database using the same credentials.
 * Usage: node scripts/db-create.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Client } = require('pg');

const urls = [
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/student_record_system',
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/student_record_system_test',
];

async function ensureDatabase(url) {
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error(`Unsupported database name: ${dbName}`);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length) {
      console.log(`[db] database "${dbName}" already exists`);
    } else {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[db] created database "${dbName}"`);
    }
  } finally {
    await client.end();
  }
}

(async () => {
  try {
    for (const url of urls) await ensureDatabase(url);
  } catch (err) {
    console.error('[db] could not create database:', err.message);
    console.error('[db] Is PostgreSQL running, and are the credentials in backend/.env correct?');
    process.exit(1);
  }
})();
