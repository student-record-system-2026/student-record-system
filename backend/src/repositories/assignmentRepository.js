'use strict';

/** DAL - Faculty-Course Assignment repository (FR-5). */
const { query } = require('../db/pool');

async function findByCourse(courseId, client) {
  const { rows } = await query(
    `SELECT ca.id, ca.course_id AS "courseId", ca.faculty_id AS "facultyId",
            ca.assigned_at AS "assignedAt", f.name AS "facultyName", f.email AS "facultyEmail",
            f.department AS "facultyDepartment", f.status AS "facultyStatus"
       FROM course_assignments ca
       JOIN faculty f ON f.id = ca.faculty_id
      WHERE ca.course_id = $1`,
    [courseId], client
  );
  return rows[0] || null;
}

async function listCoursesByFaculty(facultyId) {
  const { rows } = await query(
    `SELECT c.id, c.code, c.name, c.credits, c.status, ca.assigned_at AS "assignedAt",
            (SELECT COUNT(*)::int FROM enrollments e
              WHERE e.course_id = c.id AND e.status = 'ACTIVE') AS "enrolledCount"
       FROM course_assignments ca
       JOIN courses c ON c.id = ca.course_id
      WHERE ca.faculty_id = $1
      ORDER BY c.code`,
    [facultyId]
  );
  return rows;
}

async function isFacultyAssigned(facultyId, courseId) {
  const { rows } = await query(
    'SELECT 1 FROM course_assignments WHERE faculty_id = $1 AND course_id = $2',
    [facultyId, courseId]
  );
  return rows.length > 0;
}

async function create(courseId, facultyId, client) {
  await query(
    'INSERT INTO course_assignments (course_id, faculty_id) VALUES ($1, $2)',
    [courseId, facultyId], client
  );
}

async function update(courseId, facultyId, client) {
  await query(
    'UPDATE course_assignments SET faculty_id = $2, assigned_at = NOW() WHERE course_id = $1',
    [courseId, facultyId], client
  );
}

async function remove(courseId, client) {
  await query('DELETE FROM course_assignments WHERE course_id = $1', [courseId], client);
}

module.exports = { findByCourse, listCoursesByFaculty, isFacultyAssigned, create, update, remove };
