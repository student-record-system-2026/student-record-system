'use strict';

/** DAL - Faculty repository (FR-3, FR-12). */
const { query } = require('../db/pool');

const SELECT = `
  SELECT f.id, f.account_id AS "accountId", a.username, f.name, f.email, f.phone,
         f.department, f.designation, f.status,
         f.created_at AS "createdAt", f.updated_at AS "updatedAt"
    FROM faculty f
    JOIN accounts a ON a.id = f.account_id`;

async function list({ search, status } = {}) {
  const params = [];
  const where = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(f.name ILIKE $${params.length} OR f.email ILIKE $${params.length}
              OR f.department ILIKE $${params.length} OR a.username ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`f.status = $${params.length}`);
  }
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY f.name, f.id`;
  const { rows } = await query(sql, params);
  return rows;
}

async function findById(id, client) {
  const { rows } = await query(`${SELECT} WHERE f.id = $1`, [id], client);
  return rows[0] || null;
}

async function findByAccountId(accountId) {
  const { rows } = await query(`${SELECT} WHERE f.account_id = $1`, [accountId]);
  return rows[0] || null;
}

async function create(data, client) {
  const { rows } = await query(
    `INSERT INTO faculty (account_id, name, email, phone, department, designation)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [data.accountId, data.name, data.email, data.phone || null, data.department, data.designation || null],
    client
  );
  return findById(rows[0].id, client);
}

async function update(id, data, client) {
  await query(
    `UPDATE faculty
        SET name = $2, email = $3, phone = $4, department = $5, designation = $6,
            status = $7, updated_at = NOW()
      WHERE id = $1`,
    [id, data.name, data.email, data.phone || null, data.department, data.designation || null, data.status],
    client
  );
  return findById(id, client);
}

async function setStatus(id, status, client) {
  await query('UPDATE faculty SET status = $2, updated_at = NOW() WHERE id = $1', [id, status], client);
  return findById(id, client);
}

async function countByStatus() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active FROM faculty`
  );
  return rows[0];
}

module.exports = { list, findById, findByAccountId, create, update, setStatus, countByStatus };
