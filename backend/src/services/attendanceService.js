'use strict';

/**
 * Attendance Service (FR-7, FR-8; SADS Sequence Diagram 2).
 * - Faculty record/update present/absent per session, only for assigned courses and
 *   only for students actively enrolled in that course (SRS 5.5).
 * - Students view session-wise records and a percentage, only for their own enrolled courses.
 */
const { withTransaction } = require('../db/unitOfWork');
const courseRepository = require('../repositories/courseRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');
const attendanceRepository = require('../repositories/attendanceRepository');
const authz = require('./authorizationService');
const { NotFoundError, ConflictError, ValidationError } = require('../errors/AppError');

async function requireCourse(courseId) {
  const course = await courseRepository.findById(courseId);
  if (!course) throw new NotFoundError('Course not found.');
  return course;
}

/** Percentage of sessions attended, 1 decimal place; null when no sessions recorded yet. */
function percentage(present, total) {
  return total === 0 ? null : Math.round((present / total) * 1000) / 10;
}

/** Map submitted studentIds onto this course's active enrollments; reject anyone not enrolled. */
async function resolveEnrollments(courseId, records, tx) {
  const roster = await enrollmentRepository.listActiveByCourse(courseId, tx);
  const byStudent = new Map(roster.map((r) => [r.studentId, r.enrollmentId]));
  const errors = [];
  const entries = records.map((r, i) => {
    const enrollmentId = byStudent.get(r.studentId);
    if (!enrollmentId) {
      errors.push({ field: `records[${i}].studentId`, issue: 'not_enrolled', message: 'Student is not enrolled in this course.' });
    }
    return { enrollmentId, status: r.status };
  });
  if (errors.length) {
    throw new ValidationError('Attendance can only be recorded for students enrolled in this course.', errors);
  }
  return entries;
}

/** POST /api/courses/:id/attendance - record a new session. */
async function recordSession(actor, courseId, sessionDate, records) {
  await requireCourse(courseId);
  await authz.assertFacultyAssigned(actor, courseId);
  await withTransaction(async (tx) => {
    if (await attendanceRepository.sessionExists(courseId, sessionDate, tx)) {
      throw new ConflictError(
        `Attendance for ${sessionDate} has already been recorded. Open the session to update it.`,
        'SESSION_EXISTS'
      );
    }
    const entries = await resolveEnrollments(courseId, records, tx);
    await attendanceRepository.upsertRecords(sessionDate, entries, tx);
  });
  return getCourseAttendance(actor, courseId, sessionDate);
}

/** PUT /api/courses/:id/attendance/:sessionDate - update a previously recorded session. */
async function updateSession(actor, courseId, sessionDate, records) {
  await requireCourse(courseId);
  await authz.assertFacultyAssigned(actor, courseId);
  await withTransaction(async (tx) => {
    if (!(await attendanceRepository.sessionExists(courseId, sessionDate, tx))) {
      throw new NotFoundError(`No attendance has been recorded for ${sessionDate} yet.`);
    }
    const entries = await resolveEnrollments(courseId, records, tx);
    await attendanceRepository.upsertRecords(sessionDate, entries, tx);
  });
  return getCourseAttendance(actor, courseId, sessionDate);
}

/** GET /api/courses/:id/attendance - session-wise view for the assigned Faculty or Administrator. */
async function getCourseAttendance(actor, courseId, sessionDate = null) {
  const course = await requireCourse(courseId);
  await authz.assertAdminOrAssignedFaculty(actor, courseId);
  const [roster, rows] = await Promise.all([
    enrollmentRepository.listActiveByCourse(courseId),
    attendanceRepository.listByCourse(courseId, sessionDate),
  ]);

  const sessionsMap = new Map();
  for (const r of rows) {
    if (!sessionsMap.has(r.sessionDate)) {
      sessionsMap.set(r.sessionDate, { sessionDate: r.sessionDate, present: 0, absent: 0, records: [] });
    }
    const s = sessionsMap.get(r.sessionDate);
    s.records.push({ studentId: r.studentId, rollNumber: r.rollNumber, name: r.name, status: r.status });
    if (r.status === 'PRESENT') s.present += 1; else s.absent += 1;
  }

  const summary = roster.map((st) => {
    const mine = rows.filter((r) => r.studentId === st.studentId);
    const present = mine.filter((r) => r.status === 'PRESENT').length;
    return {
      studentId: st.studentId, rollNumber: st.rollNumber, name: st.name,
      present, total: mine.length, percentage: percentage(present, mine.length),
    };
  });

  return {
    course: { id: course.id, code: course.code, name: course.name, status: course.status },
    roster: roster.map(({ studentId, rollNumber, name }) => ({ studentId, rollNumber, name })),
    sessions: [...sessionsMap.values()],
    summary,
  };
}

/**
 * GET /api/students/:id/attendance (FR-8) - Student, self only. Optional courseId narrows to
 * one course, which must be one the student is currently enrolled in.
 */
async function getStudentAttendance(actor, studentId, courseId = null) {
  authz.assertStudentSelf(actor, studentId);
  if (courseId) await authz.assertStudentEnrolled(actor, courseId);
  const enrollments = (await enrollmentRepository.listActiveByStudent(studentId))
    .filter((e) => !courseId || e.courseId === courseId);
  const rows = await attendanceRepository.listByStudent(studentId, courseId);

  const courses = enrollments.map((e) => {
    const sessions = rows
      .filter((r) => r.courseId === e.courseId)
      .map((r) => ({ sessionDate: r.sessionDate, status: r.status }));
    const present = sessions.filter((s) => s.status === 'PRESENT').length;
    return {
      courseId: e.courseId, code: e.code, name: e.name, facultyName: e.facultyName,
      sessions, present, absent: sessions.length - present, total: sessions.length,
      percentage: percentage(present, sessions.length),
    };
  });
  return { studentId, courses };
}

module.exports = { recordSession, updateSession, getCourseAttendance, getStudentAttendance, percentage };
