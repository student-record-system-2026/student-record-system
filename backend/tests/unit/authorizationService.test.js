'use strict';

/** Unit tests - RBAC / record-scope authorization (NFR-7, SO-1, SO-3; GitHub #10, #25, #30). */
jest.mock('../../src/repositories/assignmentRepository');
jest.mock('../../src/repositories/enrollmentRepository');

const assignmentRepository = require('../../src/repositories/assignmentRepository');
const enrollmentRepository = require('../../src/repositories/enrollmentRepository');
const authz = require('../../src/services/authorizationService');
const { ForbiddenError, UnauthenticatedError } = require('../../src/errors/AppError');

const admin = { role: 'ADMIN', accountId: 1 };
const faculty = { role: 'FACULTY', accountId: 2, facultyId: 7 };
const student = { role: 'STUDENT', accountId: 3, studentId: 11 };

afterEach(() => jest.resetAllMocks());

describe('assertRole', () => {
  test('no principal -> 401', () => {
    expect(() => authz.assertRole(undefined, 'ADMIN')).toThrow(UnauthenticatedError);
  });
  test('role not allowed -> 403', () => {
    expect(() => authz.assertRole(student, 'ADMIN')).toThrow(ForbiddenError);
    expect(() => authz.assertRole(faculty, 'ADMIN', 'STUDENT')).toThrow(ForbiddenError);
  });
  test('role allowed -> passes', () => {
    expect(() => authz.assertRole(admin, 'ADMIN')).not.toThrow();
    expect(() => authz.assertRole(faculty, 'ADMIN', 'FACULTY')).not.toThrow();
  });
});

describe('assertFacultyAssigned (SRS 5.5)', () => {
  test('assigned faculty passes; lookup uses the SESSION faculty id', async () => {
    assignmentRepository.isFacultyAssigned.mockResolvedValue(true);
    await expect(authz.assertFacultyAssigned(faculty, 5)).resolves.toBeUndefined();
    expect(assignmentRepository.isFacultyAssigned).toHaveBeenCalledWith(7, 5);
  });
  test('unassigned faculty -> 403 "You are not authorized for this course."', async () => {
    assignmentRepository.isFacultyAssigned.mockResolvedValue(false);
    await expect(authz.assertFacultyAssigned(faculty, 5)).rejects.toThrow('You are not authorized for this course.');
  });
  test('non-faculty roles are rejected before any lookup', async () => {
    await expect(authz.assertFacultyAssigned(admin, 5)).rejects.toThrow(ForbiddenError);
    expect(assignmentRepository.isFacultyAssigned).not.toHaveBeenCalled();
  });
});

describe('student scope (SO-1)', () => {
  test('assertStudentSelf: own id passes, other id -> 403', () => {
    expect(() => authz.assertStudentSelf(student, 11)).not.toThrow();
    expect(() => authz.assertStudentSelf(student, 12)).toThrow(ForbiddenError);
    expect(() => authz.assertStudentSelf(admin, 11)).toThrow(ForbiddenError);
  });
  test('assertStudentEnrolled: active enrollment required', async () => {
    enrollmentRepository.isActivelyEnrolled.mockResolvedValue(false);
    await expect(authz.assertStudentEnrolled(student, 3)).rejects.toThrow('You are not enrolled in this course.');
    enrollmentRepository.isActivelyEnrolled.mockResolvedValue(true);
    await expect(authz.assertStudentEnrolled(student, 3)).resolves.toBeUndefined();
    expect(enrollmentRepository.isActivelyEnrolled).toHaveBeenLastCalledWith(11, 3);
  });
});

describe('assertCourseReadable / assertAdminOrAssignedFaculty', () => {
  test('Administrator may read any course without lookups', async () => {
    await authz.assertCourseReadable(admin, 9);
    await authz.assertAdminOrAssignedFaculty(admin, 9);
    expect(assignmentRepository.isFacultyAssigned).not.toHaveBeenCalled();
  });
  test('Student may read an enrolled course but never the course roster/marks sheet', async () => {
    enrollmentRepository.isActivelyEnrolled.mockResolvedValue(true);
    await expect(authz.assertCourseReadable(student, 9)).resolves.toBeUndefined();
    await expect(authz.assertAdminOrAssignedFaculty(student, 9)).rejects.toThrow(ForbiddenError);
  });
});
