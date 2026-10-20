'use strict';

/**
 * Marks Service (FR-9, FR-10).
 * - Faculty enter/update marks for a course's configured assessment components, only for
 *   their assigned courses and only for actively enrolled students (SRS 5.5).
 * - Marks must lie between 0 and the component's configured maximum.
 * - Students view their own marks per component, for enrolled courses only.
 */
const { withTransaction } = require('../db/unitOfWork');
const courseRepository = require('../repositories/courseRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');
const marksRepository = require('../repositories/marksRepository');
const authz = require('./authorizationService');
const { NotFoundError, ConflictError, ValidationError } = require('../errors/AppError');

async function requireCourse(courseId) {
  const course = await courseRepository.findById(courseId);
  if (!course) throw new NotFoundError('Course not found.');
  return course;
}

async function requireComponent(courseId, componentId, tx) {
  const component = await courseRepository.findComponent(courseId, componentId, tx);
  if (!component) throw new NotFoundError('Assessment component not found for this course.');
  return component;
}

/** Validate entries against enrollment and the component maximum; map to enrollment ids. */
async function resolveEntries(courseId, component, entries, tx) {
  const roster = await enrollmentRepository.listActiveByCourse(courseId, tx);
  const byStudent = new Map(roster.map((r) => [r.studentId, r.enrollmentId]));
  const errors = [];
  const resolved = entries.map((e, i) => {
    const enrollmentId = byStudent.get(e.studentId);
    if (!enrollmentId) {
      errors.push({ field: `marks[${i}].studentId`, issue: 'not_enrolled', message: 'Student is not enrolled in this course.' });
    }
    if (e.marksObtained > component.maxMarks) {
      errors.push({
        field: `marks[${i}].marksObtained`, issue: 'out_of_range',
        message: `Marks must be between 0 and ${component.maxMarks} for ${component.name}.`,
      });
    }
    return { enrollmentId, marksObtained: e.marksObtained };
  });
  if (errors.length) throw new ValidationError(errors[0].message, errors);
  return resolved;
}

/** POST /api/courses/:id/marks - enter marks for a component (first entry). */
async function enterMarks(actor, courseId, componentId, entries) {
  await requireCourse(courseId);
  await authz.assertFacultyAssigned(actor, courseId);
  await withTransaction(async (tx) => {
    const component = await requireComponent(courseId, componentId, tx);
    const resolved = await resolveEntries(courseId, component, entries, tx);
    const existing = await marksRepository.findExisting(componentId, resolved.map((r) => r.enrollmentId), tx);
    if (existing.length) {
      throw new ConflictError(
        `Marks for ${component.name} have already been entered for ${existing.length} student(s). Use update instead.`,
        'MARKS_EXIST'
      );
    }
    await marksRepository.upsert(componentId, resolved, tx);
  });
  return getCourseMarks(actor, courseId);
}

/** PUT /api/courses/:id/marks/:componentId - update previously entered marks (adds any missing). */
async function updateMarks(actor, courseId, componentId, entries) {
  await requireCourse(courseId);
  await authz.assertFacultyAssigned(actor, courseId);
  await withTransaction(async (tx) => {
    const component = await requireComponent(courseId, componentId, tx);
    const resolved = await resolveEntries(courseId, component, entries, tx);
    await marksRepository.upsert(componentId, resolved, tx);
  });
  return getCourseMarks(actor, courseId);
}

/** GET /api/courses/:id/marks - assigned Faculty or Administrator. */
async function getCourseMarks(actor, courseId) {
  const course = await requireCourse(courseId);
  await authz.assertAdminOrAssignedFaculty(actor, courseId);
  const [components, roster, rows] = await Promise.all([
    courseRepository.listComponents(courseId),
    enrollmentRepository.listActiveByCourse(courseId),
    marksRepository.listByCourse(courseId),
  ]);
  const students = roster.map((st) => {
    const marks = {};
    for (const r of rows.filter((x) => x.studentId === st.studentId)) marks[r.componentId] = r.marksObtained;
    return { studentId: st.studentId, rollNumber: st.rollNumber, name: st.name, marks };
  });
  const enteredComponentIds = [...new Set(rows.map((r) => r.componentId))];
  return {
    course: { id: course.id, code: course.code, name: course.name, status: course.status },
    components,
    enteredComponentIds,
    students,
  };
}

/** GET /api/students/:id/marks (FR-10) - Student, self only, enrolled courses only. */
async function getStudentMarks(actor, studentId, courseId = null) {
  authz.assertStudentSelf(actor, studentId);
  if (courseId) await authz.assertStudentEnrolled(actor, courseId);
  const enrollments = (await enrollmentRepository.listActiveByStudent(studentId))
    .filter((e) => !courseId || e.courseId === courseId);
  const rows = await marksRepository.listByStudent(studentId, courseId);

  const courses = [];
  for (const e of enrollments) {
    const comps = await courseRepository.listComponents(e.courseId);
    const components = comps.map((c) => {
      const m = rows.find((r) => r.courseId === e.courseId && r.componentId === c.id);
      return { componentId: c.id, name: c.name, maxMarks: c.maxMarks, marksObtained: m ? m.marksObtained : null };
    });
    const entered = components.filter((c) => c.marksObtained !== null);
    courses.push({
      courseId: e.courseId, code: e.code, name: e.name, facultyName: e.facultyName,
      components,
      enteredCount: entered.length,
      totalObtained: entered.reduce((s, c) => s + c.marksObtained, 0),
      totalMaxEntered: entered.reduce((s, c) => s + c.maxMarks, 0),
    });
  }
  return { studentId, courses };
}

module.exports = { enterMarks, updateMarks, getCourseMarks, getStudentMarks };
