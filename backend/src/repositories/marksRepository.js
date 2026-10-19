'use strict';

/** DAL - Marks repository (FR-9, FR-10). */
const { query } = require('../db/pool');

/** Enrollment ids (from the given list) that already have marks for a component. */
async function findExisting(componentId, enrollmentIds, client) {
  if (!enrollmentIds.length) return [];
  const { rows } = await query(
    'SELECT enrollment_id AS "enrollmentId" FROM marks WHERE component_id = $1 AND enrollment_id = ANY($2::int[])',
    [componentId, enrollmentIds], client
  );
  return rows.map((r) => r.enrollmentId);
}

async function upsert(componentId, entries, client) {
  for (const { enrollmentId, marksObtained } of entries) {
    await query(
      `INSERT INTO marks (enrollment_id, component_id, marks_obtained)
       VALUES ($1, $2, $3)
       ON CONFLICT (enrollment_id, component_id)
       DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, updated_at = NOW()`,
      [enrollmentId, componentId, marksObtained], client
    );
  }
}

/** All marks recorded for a course's active enrollments. */
async function listByCourse(courseId) {
  const { rows } = await query(
    `SELECT m.component_id AS "componentId", m.marks_obtained AS "marksObtained",
            m.updated_at AS "updatedAt", e.student_id AS "studentId"
       FROM marks m
       JOIN enrollments e ON e.id = m.enrollment_id
      WHERE e.course_id = $1 AND e.status = 'ACTIVE'`,
    [courseId]
  );
  return rows;
}

/** A student's marks for actively enrolled courses (optionally one course). */
async function listByStudent(studentId, courseId = null) {
  const { rows } = await query(
    `SELECT e.course_id AS "courseId", m.component_id AS "componentId",
            m.marks_obtained AS "marksObtained"
       FROM marks m
       JOIN enrollments e ON e.id = m.enrollment_id
      WHERE e.student_id = $1 AND e.status = 'ACTIVE'
        AND ($2::int IS NULL OR e.course_id = $2::int)`,
    [studentId, courseId]
  );
  return rows;
}

module.exports = { findExisting, upsert, listByCourse, listByStudent };
