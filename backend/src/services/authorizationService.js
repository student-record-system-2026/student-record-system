'use strict';

/**
 * RBAC / Authorization Service - cross-cutting security concern (SADS 3.6).
 * Used by the Controller/API Layer (role gate on every route) AND re-applied inside
 * services for record-level scope: a Faculty member's assigned courses, a Student's
 * own records and enrolled courses (SRS 5.5, NFR-7, SO-1, SO-2, SO-3).
 * Scope is always resolved from the session principal, never from client-supplied ids.
 */
const assignmentRepository = require('../repositories/assignmentRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');
const { ForbiddenError, UnauthenticatedError } = require('../errors/AppError');
const { ROLES } = require('./roles');

const NOT_ASSIGNED_MESSAGE = 'You are not authorized for this course.';
const NOT_ENROLLED_MESSAGE = 'You are not enrolled in this course.';
const NOT_SELF_MESSAGE = 'You can only view your own records.';

function assertAuthenticated(principal) {
  if (!principal || !principal.role) throw new UnauthenticatedError();
}

/** Role check: is the caller's role one of `allowed`? */
function assertRole(principal, ...allowed) {
  assertAuthenticated(principal);
  if (!allowed.includes(principal.role)) {
    throw new ForbiddenError('Your role is not permitted to perform this operation.');
  }
}

function hasRole(principal, role) {
  return Boolean(principal) && principal.role === role;
}

/** SRS 5.5: a Faculty member may act only on courses assigned to them. */
async function assertFacultyAssigned(principal, courseId) {
  assertRole(principal, ROLES.FACULTY);
  const assigned = await assignmentRepository.isFacultyAssigned(principal.facultyId, courseId);
  if (!assigned) throw new ForbiddenError(NOT_ASSIGNED_MESSAGE);
}

/** SRS 5.5: a Student may view attendance and marks only for currently enrolled courses. */
async function assertStudentEnrolled(principal, courseId) {
  assertRole(principal, ROLES.STUDENT);
  const enrolled = await enrollmentRepository.isActivelyEnrolled(principal.studentId, courseId);
  if (!enrolled) throw new ForbiddenError(NOT_ENROLLED_MESSAGE);
}

/** SO-1: a Student may only access their own student id. */
function assertStudentSelf(principal, studentId) {
  assertRole(principal, ROLES.STUDENT);
  if (principal.studentId !== studentId) throw new ForbiddenError(NOT_SELF_MESSAGE);
}

/**
 * Read access to a single course's data:
 * Administrator - any course; Faculty - assigned courses; Student - enrolled courses.
 */
async function assertCourseReadable(principal, courseId) {
  assertAuthenticated(principal);
  if (principal.role === ROLES.ADMIN) return;
  if (principal.role === ROLES.FACULTY) return assertFacultyAssigned(principal, courseId);
  if (principal.role === ROLES.STUDENT) return assertStudentEnrolled(principal, courseId);
  throw new ForbiddenError();
}

/** Course roster / attendance / marks views: Administrator or the assigned Faculty member. */
async function assertAdminOrAssignedFaculty(principal, courseId) {
  assertAuthenticated(principal);
  if (principal.role === ROLES.ADMIN) return;
  if (principal.role === ROLES.FACULTY) return assertFacultyAssigned(principal, courseId);
  throw new ForbiddenError('Your role is not permitted to perform this operation.');
}

module.exports = {
  assertAuthenticated,
  assertRole,
  hasRole,
  assertFacultyAssigned,
  assertStudentEnrolled,
  assertStudentSelf,
  assertCourseReadable,
  assertAdminOrAssignedFaculty,
  NOT_ASSIGNED_MESSAGE,
  NOT_ENROLLED_MESSAGE,
  NOT_SELF_MESSAGE,
};
