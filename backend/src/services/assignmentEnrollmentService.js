'use strict';

/**
 * Assignment / Enrollment logic (FR-5, FR-6; SADS 3.3.3).
 * - Each course has at most one assigned faculty member (SRS 2.7).
 * - Inactive faculty are excluded from new assignments (FR-3); inactive students from
 *   new enrollments (FR-2); inactive courses accept neither.
 * - Removing an enrollment marks it REMOVED so historical attendance/marks stay intact;
 *   re-enrolling the same student reactivates it.
 */
const { withTransaction } = require('../db/unitOfWork');
const courseRepository = require('../repositories/courseRepository');
const facultyRepository = require('../repositories/facultyRepository');
const studentRepository = require('../repositories/studentRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');
const authz = require('./authorizationService');
const { ROLES } = require('./roles');
const { NotFoundError, ConflictError, ForbiddenError } = require('../errors/AppError');

async function requireCourse(courseId, tx) {
  const course = await courseRepository.findById(courseId, tx);
  if (!course) throw new NotFoundError('Course not found.');
  return course;
}

function assertCourseActive(course) {
  if (course.status !== 'ACTIVE') {
    throw new ConflictError(`Course ${course.code} is inactive and cannot accept new assignments or enrollments.`, 'COURSE_INACTIVE');
  }
}

async function requireActiveFaculty(facultyId, tx) {
  const faculty = await facultyRepository.findById(facultyId, tx);
  if (!faculty) throw new NotFoundError('Faculty member not found.');
  if (faculty.status !== 'ACTIVE') {
    throw new ConflictError(`${faculty.name} is inactive and cannot be assigned to courses.`, 'FACULTY_INACTIVE');
  }
  return faculty;
}

// ---- FR-5: Faculty-Course Assignment -----------------------------------------

/** View: Administrator; Faculty (only if it is their own assignment); Student (enrolled course). */
async function getAssignment(actor, courseId) {
  await requireCourse(courseId);
  authz.assertAuthenticated(actor);
  if (actor.role === ROLES.FACULTY) await authz.assertFacultyAssigned(actor, courseId);
  else if (actor.role === ROLES.STUDENT) await authz.assertStudentEnrolled(actor, courseId);
  else if (actor.role !== ROLES.ADMIN) throw new ForbiddenError();
  return assignmentRepository.findByCourse(courseId);
}

async function assign(actor, courseId, facultyId) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    const course = await requireCourse(courseId, tx);
    assertCourseActive(course);
    await requireActiveFaculty(facultyId, tx);
    const existing = await assignmentRepository.findByCourse(courseId, tx);
    if (existing) {
      throw new ConflictError(
        `Course ${course.code} is already assigned to ${existing.facultyName}. Modify the existing assignment instead.`,
        'ALREADY_ASSIGNED'
      );
    }
    await assignmentRepository.create(courseId, facultyId, tx);
    return assignmentRepository.findByCourse(courseId, tx);
  });
}

async function reassign(actor, courseId, facultyId) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    await requireCourse(courseId, tx);
    const existing = await assignmentRepository.findByCourse(courseId, tx);
    if (!existing) throw new NotFoundError('This course has no faculty assignment to modify.');
    if (existing.facultyId !== facultyId) {
      await requireActiveFaculty(facultyId, tx);
      await assignmentRepository.update(courseId, facultyId, tx);
    }
    return assignmentRepository.findByCourse(courseId, tx);
  });
}

async function unassign(actor, courseId) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    await requireCourse(courseId, tx);
    const existing = await assignmentRepository.findByCourse(courseId, tx);
    if (!existing) throw new NotFoundError('This course has no faculty assignment to remove.');
    await assignmentRepository.remove(courseId, tx);
    return { removed: true };
  });
}

// ---- FR-6: Student-Course Enrollment -----------------------------------------

/** View enrolled students: Administrator or the assigned Faculty member. */
async function listEnrollments(actor, courseId) {
  await requireCourse(courseId);
  await authz.assertAdminOrAssignedFaculty(actor, courseId);
  return enrollmentRepository.listActiveByCourse(courseId);
}

async function enroll(actor, courseId, studentId) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    const course = await requireCourse(courseId, tx);
    assertCourseActive(course);
    const student = await studentRepository.findById(studentId, tx);
    if (!student) throw new NotFoundError('Student not found.');
    if (student.status !== 'ACTIVE') {
      throw new ConflictError(`${student.name} is inactive and cannot be enrolled in courses.`, 'STUDENT_INACTIVE');
    }
    const existing = await enrollmentRepository.find(studentId, courseId, tx);
    if (existing && existing.status === 'ACTIVE') {
      throw new ConflictError(`${student.name} is already enrolled in ${course.code}.`, 'ALREADY_ENROLLED');
    }
    if (existing) await enrollmentRepository.setStatus(existing.id, 'ACTIVE', tx);
    else await enrollmentRepository.create(studentId, courseId, tx);
    return { courseId, studentId, studentName: student.name, rollNumber: student.rollNumber, status: 'ACTIVE' };
  });
}

async function unenroll(actor, courseId, studentId) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    await requireCourse(courseId, tx);
    const existing = await enrollmentRepository.find(studentId, courseId, tx);
    if (!existing || existing.status !== 'ACTIVE') {
      throw new NotFoundError('This student is not enrolled in this course.');
    }
    await enrollmentRepository.setStatus(existing.id, 'REMOVED', tx);
    return { removed: true };
  });
}

module.exports = { getAssignment, assign, reassign, unassign, listEnrollments, enroll, unenroll };
