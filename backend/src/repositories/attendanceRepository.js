'use strict';

/** DAL - Attendance repository (FR-7, FR-8). */
const { query } = require('../db/pool');

/** True if any attendance has been recorded for this course on this session date. */
async function sessionExists(courseId, sessionDate, client) {
  const { rows } = await query(
    `SELECT 1 FROM attendance a
       JOIN enrollments e ON e.id = a.enrollment_id
      WHERE e.course_id = $1 AND a.session_date = $2 LIMIT 1`,
    [courseId, sessionDate], client
  );
  return rows.length > 0;
}

/** Insert or update one present/absent row per enrollment for a session date. */
async function upsertRecords(sessionDate, entries, client) {
  for (const { enrollmentId, status } of entries) {
    await query(
      `INSERT INTO attendance (enrollment_id, session_date, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (enrollment_id, session_date)
       DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
      [enrollmentId, sessionDate, status], client
    );
  }
}

/** Session-wise attendance for a course (active enrollments), optionally for one date. */
async function listByCourse(courseId, sessionDate = null) {
  const { rows } = await query(
    `SELECT a.session_date AS "sessionDate", a.status, a.updated_at AS "updatedAt",
            s.id AS "studentId", s.roll_number AS "rollNumber", s.name
       FROM attendance a
       JOIN enrollments e ON e.id = a.enrollment_id
       JOIN students s ON s.id = e.student_id
      WHERE e.course_id = $1 AND e.status = 'ACTIVE'
        AND ($2::date IS NULL OR a.session_date = $2::date)
      ORDER BY a.session_date DESC, s.roll_number`,
    [courseId, sessionDate]
  );
  return rows;
}

/** A student's session records for their actively enrolled courses (optionally one course). */
async function listByStudent(studentId, courseId = null) {
  const { rows } = await query(
    `SELECT e.course_id AS "courseId", a.session_date AS "sessionDate", a.status
       FROM attendance a
       JOIN enrollments e ON e.id = a.enrollment_id
      WHERE e.student_id = $1 AND e.status = 'ACTIVE'
        AND ($2::int IS NULL OR e.course_id = $2::int)
      ORDER BY a.session_date`,
    [studentId, courseId]
  );
  return rows;
}

module.exports = { sessionExists, upsertRecords, listByCourse, listByStudent };
