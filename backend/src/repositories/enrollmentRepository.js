'use strict';

/** DAL - Student-Course Enrollment repository (FR-6). */
const { query } = require('../db/pool');

async function find(studentId, courseId, client) {
  const { rows } = await query(
    `SELECT id, student_id AS "studentId", course_id AS "courseId", status,
            enrolled_at AS "enrolledAt"
       FROM enrollments WHERE student_id = $1 AND course_id = $2`,
    [studentId, courseId], client
  );
  return rows[0] || null;
}

async function isActivelyEnrolled(studentId, courseId) {
  const { rows } = await query(
    `SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = 'ACTIVE'`,
    [studentId, courseId]
  );
  return rows.length > 0;
}

/** Active enrollments of a course, with student details (roster). */
async function listActiveByCourse(courseId, client) {
  const { rows } = await query(
    `SELECT e.id AS "enrollmentId", e.enrolled_at AS "enrolledAt",
            s.id AS "studentId", s.roll_number AS "rollNumber", s.name, s.email,
            s.department, s.batch, s.status AS "studentStatus"
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
      WHERE e.course_id = $1 AND e.status = 'ACTIVE'
      ORDER BY s.roll_number`,
    [courseId], client
  );
  return rows;
}

/** Active enrollments of a student, with course and assigned-faculty details. */
async function listActiveByStudent(studentId) {
  const { rows } = await query(
    `SELECT e.id AS "enrollmentId", e.enrolled_at AS "enrolledAt",
            c.id AS "courseId", c.code, c.name, c.credits, c.status AS "courseStatus",
            f.name AS "facultyName"
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN course_assignments ca ON ca.course_id = c.id
       LEFT JOIN faculty f ON f.id = ca.faculty_id
      WHERE e.student_id = $1 AND e.status = 'ACTIVE'
      ORDER BY c.code`,
    [studentId]
  );
  return rows;
}

async function create(studentId, courseId, client) {
  await query(
    'INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2)',
    [studentId, courseId], client
  );
}

async function setStatus(enrollmentId, status, client) {
  await query(
    'UPDATE enrollments SET status = $2, updated_at = NOW() WHERE id = $1',
    [enrollmentId, status], client
  );
}

module.exports = { find, isActivelyEnrolled, listActiveByCourse, listActiveByStudent, create, setStatus };
