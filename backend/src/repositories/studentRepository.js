'use strict';

/** DAL - Student repository (FR-2, FR-11). */
const { query } = require('../db/pool');

const SELECT = `
  SELECT s.id, s.account_id AS "accountId", a.username, s.roll_number AS "rollNumber",
         s.name, s.email, s.phone, s.department, s.batch, s.status,
         s.created_at AS "createdAt", s.updated_at AS "updatedAt"
    FROM students s
    JOIN accounts a ON a.id = s.account_id`;

async function list({ search, status } = {}) {
  const params = [];
  const where = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(s.name ILIKE $${params.length} OR s.roll_number ILIKE $${params.length}
              OR s.email ILIKE $${params.length} OR s.department ILIKE $${params.length}
              OR a.username ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`s.status = $${params.length}`);
  }
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.roll_number`;
  const { rows } = await query(sql, params);
  return rows;
}

async function findById(id, client) {
  const { rows } = await query(`${SELECT} WHERE s.id = $1`, [id], client);
  return rows[0] || null;
}

async function findByAccountId(accountId) {
  const { rows } = await query(`${SELECT} WHERE s.account_id = $1`, [accountId]);
  return rows[0] || null;
}

async function rollNumberExists(rollNumber, excludeId = null, client) {
  const { rows } = await query(
    `SELECT 1 FROM students WHERE UPPER(roll_number) = UPPER($1) AND ($2::int IS NULL OR id <> $2::int)`,
    [rollNumber, excludeId], client
  );
  return rows.length > 0;
}

async function create(data, client) {
  const { rows } = await query(
    `INSERT INTO students (account_id, roll_number, name, email, phone, department, batch)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [data.accountId, data.rollNumber, data.name, data.email, data.phone || null, data.department, data.batch],
    client
  );
  return findById(rows[0].id, client);
}

async function update(id, data, client) {
  await query(
    `UPDATE students
        SET roll_number = $2, name = $3, email = $4, phone = $5, department = $6, batch = $7,
            status = $8, updated_at = NOW()
      WHERE id = $1`,
    [id, data.rollNumber, data.name, data.email, data.phone || null, data.department, data.batch, data.status],
    client
  );
  return findById(id, client);
}

async function setStatus(id, status, client) {
  await query('UPDATE students SET status = $2, updated_at = NOW() WHERE id = $1', [id, status], client);
  return findById(id, client);
}

async function countByStatus() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active FROM students`
  );
  return rows[0];
}

module.exports = { list, findById, findByAccountId, rollNumberExists, create, update, setStatus, countByStatus };
