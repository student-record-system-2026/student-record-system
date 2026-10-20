'use strict';

/** DAL - Account repository (FR-1, NFR-2). The only module that reads password hashes. */
const { query } = require('../db/pool');

const COLUMNS = `id, username, email, role, created_at AS "createdAt"`;

async function findForLogin(identifier) {
  const { rows } = await query(
    `SELECT id, username, email, role, password_hash AS "passwordHash"
       FROM accounts
      WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
      ORDER BY (LOWER(username) = LOWER($1)) DESC
      LIMIT 1`,
    [identifier]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM accounts WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function usernameExists(username, client) {
  const { rows } = await query(
    'SELECT 1 FROM accounts WHERE LOWER(username) = LOWER($1)', [username], client
  );
  return rows.length > 0;
}

async function emailExists(email, excludeAccountId = null, client) {
  const { rows } = await query(
    `SELECT 1 FROM accounts
      WHERE LOWER(email) = LOWER($1) AND ($2::int IS NULL OR id <> $2::int)`,
    [email, excludeAccountId], client
  );
  return rows.length > 0;
}

async function create({ username, email, passwordHash, role }, client) {
  const { rows } = await query(
    `INSERT INTO accounts (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    [username, email || null, passwordHash, role], client
  );
  return rows[0];
}

async function updateEmail(id, email, client) {
  await query('UPDATE accounts SET email = $2 WHERE id = $1', [id, email || null], client);
}

module.exports = { findForLogin, findById, usernameExists, emailExists, create, updateEmail };
