'use strict';

/**
 * Data Access Layer infrastructure: the single PostgreSQL connection pool.
 * Only modules under src/db and src/repositories may import this file (SADS 3.1).
 */
const { Pool, types } = require('pg');
const config = require('../config');
const { ServiceUnavailableError } = require('../errors/AppError');

// Return DATE columns as 'YYYY-MM-DD' strings (no timezone shifting) and NUMERIC as numbers.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

pool.on('error', (err) => {
  // Idle-client errors must not crash the process (NFR-4).
  console.error('[db] idle client error:', err.message);
});

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
  '57P01', '57P02', '57P03', // admin shutdown / crash shutdown / cannot connect now
  '3D000', // database does not exist
  '28P01', // invalid password
]);

/** Translate low-level connectivity failures into a 503 without leaking internals (SADS 4.4). */
function translate(err) {
  if (err && CONNECTION_ERROR_CODES.has(err.code)) {
    console.error('[db] connection failure:', err.code, err.message);
    return new ServiceUnavailableError();
  }
  return err;
}

/** Run a parameterized query, on the given client (inside a transaction) or the pool. */
async function query(text, params = [], client = null) {
  try {
    return await (client || pool).query(text, params);
  } catch (err) {
    throw translate(err);
  }
}

/**
 * Unit of work: runs `work(client)` inside a transaction. Any thrown error rolls back,
 * so a failed operation never leaves partial writes (SADS 4.4, NFR-4).
 */
async function withTransaction(work) {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    throw translate(err);
  }
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore rollback failure; original error is more useful */
    }
    throw translate(err);
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
