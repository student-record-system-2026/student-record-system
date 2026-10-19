'use strict';

/**
 * DAL - Course repository (FR-4), including the per-course assessment components
 * (SADS 4.6 / SRS TBD-2), which are configured as part of course setup.
 */
const { query } = require('../db/pool');

const SELECT = `
  SELECT c.id, c.code, c.name, c.credits, c.status,
         c.created_at AS "createdAt", c.updated_at AS "updatedAt",
         ca.faculty_id AS "facultyId", f.name AS "facultyName",
         (SELECT COUNT(*)::int FROM enrollments e
           WHERE e.course_id = c.id AND e.status = 'ACTIVE') AS "enrolledCount"
    FROM courses c
    LEFT JOIN course_assignments ca ON ca.course_id = c.id
    LEFT JOIN faculty f ON f.id = ca.faculty_id`;

/**
 * List courses. `facultyId` limits to courses assigned to that faculty member;
 * `studentId` limits to courses the student is actively enrolled in (SO-1 scoping).
 */
async function list({ search, status, facultyId, studentId } = {}) {
  const params = [];
  const where = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(c.code ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`c.status = $${params.length}`);
  }
  if (facultyId) {
    params.push(facultyId);
    where.push(`ca.faculty_id = $${params.length}`);
  }
  if (studentId) {
    params.push(studentId);
    where.push(`EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id
                         AND e.student_id = $${params.length} AND e.status = 'ACTIVE')`);
  }
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.code`;
  const { rows } = await query(sql, params);
  return rows;
}

async function findById(id, client) {
  const { rows } = await query(`${SELECT} WHERE c.id = $1`, [id], client);
  return rows[0] || null;
}

async function codeExists(code, excludeId = null, client) {
  const { rows } = await query(
    `SELECT 1 FROM courses WHERE UPPER(code) = UPPER($1) AND ($2::int IS NULL OR id <> $2::int)`,
    [code, excludeId], client
  );
  return rows.length > 0;
}

async function create({ code, name, credits }, client) {
  const { rows } = await query(
    'INSERT INTO courses (code, name, credits) VALUES ($1, $2, $3) RETURNING id',
    [code, name, credits], client
  );
  return rows[0].id;
}

async function update(id, { code, name, credits, status }, client) {
  await query(
    `UPDATE courses SET code = $2, name = $3, credits = $4, status = $5, updated_at = NOW() WHERE id = $1`,
    [id, code, name, credits, status], client
  );
}

async function setStatus(id, status, client) {
  await query('UPDATE courses SET status = $2, updated_at = NOW() WHERE id = $1', [id, status], client);
}

/**
 * Database-level check used before a physical delete (SADS 3.5 / 4.6): counts every
 * assignment and enrollment row (including removed enrollments, whose history must be kept).
 */
async function countAssociations(id, client) {
  const { rows } = await query(
    `SELECT (SELECT COUNT(*)::int FROM course_assignments WHERE course_id = $1) AS assignments,
            (SELECT COUNT(*)::int FROM enrollments WHERE course_id = $1) AS enrollments`,
    [id], client
  );
  return rows[0];
}

async function remove(id, client) {
  await query('DELETE FROM courses WHERE id = $1', [id], client);
}

async function countByStatus() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active FROM courses`
  );
  return rows[0];
}

// ---- Assessment components -------------------------------------------------

async function listComponents(courseId, client) {
  const { rows } = await query(
    `SELECT id, course_id AS "courseId", name, max_marks AS "maxMarks", position
       FROM assessment_components WHERE course_id = $1 ORDER BY position, id`,
    [courseId], client
  );
  return rows;
}

async function findComponent(courseId, componentId, client) {
  const { rows } = await query(
    `SELECT id, course_id AS "courseId", name, max_marks AS "maxMarks", position
       FROM assessment_components WHERE course_id = $1 AND id = $2`,
    [courseId, componentId], client
  );
  return rows[0] || null;
}

async function insertComponent(courseId, { name, maxMarks, position }, client) {
  await query(
    'INSERT INTO assessment_components (course_id, name, max_marks, position) VALUES ($1, $2, $3, $4)',
    [courseId, name, maxMarks, position], client
  );
}

async function updateComponent(componentId, { name, maxMarks, position }, client) {
  await query(
    'UPDATE assessment_components SET name = $2, max_marks = $3, position = $4 WHERE id = $1',
    [componentId, name, maxMarks, position], client
  );
}

async function deleteComponent(componentId, client) {
  await query('DELETE FROM assessment_components WHERE id = $1', [componentId], client);
}

/** Highest mark already recorded against a component (used to validate a lowered maximum). */
async function componentMarkStats(componentId, client) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count, COALESCE(MAX(marks_obtained), 0) AS "maxRecorded"
       FROM marks WHERE component_id = $1`,
    [componentId], client
  );
  return rows[0];
}

module.exports = {
  list, findById, codeExists, create, update, setStatus, countAssociations, remove, countByStatus,
  listComponents, findComponent, insertComponent, updateComponent, deleteComponent, componentMarkStats,
};
