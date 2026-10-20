'use strict';

/**
 * Unit tests - business rules in the Service Layer with the Data Access Layer mocked:
 *  - FR-4 / SRS 5.5 course delete-vs-deactivate (GitHub #13)
 *  - FR-2 / FR-3 only the Administrator may write records (SO-2; GitHub #11, #12, #30)
 *  - FR-6 inactive students excluded from enrollment (GitHub #15)
 *  - FR-8 attendance percentage (GitHub #17)
 *  - FR-9 marks bounded by the component maximum (GitHub #18)
 */
jest.mock('../../src/db/unitOfWork', () => ({ withTransaction: (fn) => fn('tx') }));
jest.mock('../../src/repositories/courseRepository');
jest.mock('../../src/repositories/studentRepository');
jest.mock('../../src/repositories/accountRepository');
jest.mock('../../src/repositories/enrollmentRepository');
jest.mock('../../src/repositories/assignmentRepository');
jest.mock('../../src/repositories/marksRepository');

const courseRepository = require('../../src/repositories/courseRepository');
const studentRepository = require('../../src/repositories/studentRepository');
const enrollmentRepository = require('../../src/repositories/enrollmentRepository');
const assignmentRepository = require('../../src/repositories/assignmentRepository');
const marksRepository = require('../../src/repositories/marksRepository');
const courseService = require('../../src/services/courseService');
const studentService = require('../../src/services/studentService');
const assocService = require('../../src/services/assignmentEnrollmentService');
const attendanceService = require('../../src/services/attendanceService');
const marksService = require('../../src/services/marksService');
const { ConflictError, ForbiddenError, ValidationError } = require('../../src/errors/AppError');

const admin = { role: 'ADMIN' };
const faculty = { role: 'FACULTY', facultyId: 7 };
const student = { role: 'STUDENT', studentId: 11 };

afterEach(() => jest.resetAllMocks());

describe('Course delete rule (FR-4, SRS 5.5)', () => {
  beforeEach(() => courseRepository.findById.mockResolvedValue({ id: 1, code: 'UE24CS301', status: 'ACTIVE' }));

  test('no assignment and no enrollment -> physically deleted', async () => {
    courseRepository.countAssociations.mockResolvedValue({ assignments: 0, enrollments: 0 });
    await expect(courseService.remove(admin, 1)).resolves.toEqual({ deleted: true });
    expect(courseRepository.remove).toHaveBeenCalledWith(1, 'tx');
    expect(courseRepository.setStatus).not.toHaveBeenCalled();
  });

  test.each([[1, 0], [0, 3], [1, 3]])('assignments=%i enrollments=%i -> deactivated, 409 reported', async (a, e) => {
    courseRepository.countAssociations.mockResolvedValue({ assignments: a, enrollments: e });
    await expect(courseService.remove(admin, 1)).rejects.toMatchObject({ status: 409, code: 'COURSE_DEACTIVATED_INSTEAD' });
    expect(courseRepository.setStatus).toHaveBeenCalledWith(1, 'INACTIVE', 'tx');
    expect(courseRepository.remove).not.toHaveBeenCalled();
  });

  test('non-admin cannot delete (checked in the service, independent of the UI/route)', async () => {
    await expect(courseService.remove(faculty, 1)).rejects.toThrow(ForbiddenError);
    expect(courseRepository.countAssociations).not.toHaveBeenCalled();
  });

  test('duplicate component names are rejected', async () => {
    await expect(courseService.create(admin, { code: 'X1', name: 'X', credits: 3 },
      [{ name: 'Quiz', maxMarks: 5 }, { name: 'quiz', maxMarks: 5 }])).rejects.toThrow(ValidationError);
  });
});

describe('Record writes are Administrator-only in the service layer (SO-2)', () => {
  test.each([faculty, student])('role %o cannot create/update/deactivate a student', async (actor) => {
    await expect(studentService.create(actor, {})).rejects.toThrow(ForbiddenError);
    await expect(studentService.update(actor, 1, {})).rejects.toThrow(ForbiddenError);
    await expect(studentService.deactivate(actor, 1)).rejects.toThrow(ForbiddenError);
    expect(studentRepository.create).not.toHaveBeenCalled();
  });
});

describe('Enrollment eligibility (FR-2 / FR-6)', () => {
  beforeEach(() => courseRepository.findById.mockResolvedValue({ id: 1, code: 'UE24CS205', status: 'ACTIVE' }));

  test('inactive student cannot be enrolled', async () => {
    studentRepository.findById.mockResolvedValue({ id: 5, name: 'X', status: 'INACTIVE' });
    await expect(assocService.enroll(admin, 1, 5)).rejects.toMatchObject({ code: 'STUDENT_INACTIVE' });
    expect(enrollmentRepository.create).not.toHaveBeenCalled();
  });

  test('previously removed enrollment is reactivated (history preserved) instead of duplicated', async () => {
    studentRepository.findById.mockResolvedValue({ id: 5, name: 'X', status: 'ACTIVE', rollNumber: 'R1' });
    enrollmentRepository.find.mockResolvedValue({ id: 99, status: 'REMOVED' });
    await assocService.enroll(admin, 1, 5);
    expect(enrollmentRepository.setStatus).toHaveBeenCalledWith(99, 'ACTIVE', 'tx');
    expect(enrollmentRepository.create).not.toHaveBeenCalled();
  });

  test('inactive course accepts no new enrollment', async () => {
    courseRepository.findById.mockResolvedValue({ id: 1, code: 'UE24CS205', status: 'INACTIVE' });
    await expect(assocService.enroll(admin, 1, 5)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('Attendance percentage (FR-8)', () => {
  test.each([[0, 0, null], [3, 4, 75], [2, 3, 66.7], [5, 5, 100], [0, 6, 0]])(
    'present=%i total=%i -> %p', (p, t, expected) => expect(attendanceService.percentage(p, t)).toBe(expected)
  );
});

describe('Marks bounded by component maximum (FR-9)', () => {
  beforeEach(() => {
    courseRepository.findById.mockResolvedValue({ id: 1, code: 'UE24CS205', status: 'ACTIVE' });
    assignmentRepository.isFacultyAssigned.mockResolvedValue(true);
    courseRepository.findComponent.mockResolvedValue({ id: 3, name: 'Internal Assessment 1', maxMarks: 20 });
    enrollmentRepository.listActiveByCourse.mockResolvedValue([{ studentId: 11, enrollmentId: 50 }]);
  });

  test('marks above the maximum are rejected and nothing is written', async () => {
    await expect(marksService.updateMarks(faculty, 1, 3, [{ studentId: 11, marksObtained: 21 }]))
      .rejects.toThrow('Marks must be between 0 and 20 for Internal Assessment 1.');
    expect(marksRepository.upsert).not.toHaveBeenCalled();
  });

  test('student not enrolled in the course is rejected', async () => {
    await expect(marksService.updateMarks(faculty, 1, 3, [{ studentId: 12, marksObtained: 5 }]))
      .rejects.toMatchObject({ status: 400, details: [expect.objectContaining({ issue: 'not_enrolled' })] });
  });

  test('unassigned faculty is rejected before any marks are examined', async () => {
    assignmentRepository.isFacultyAssigned.mockResolvedValue(false);
    await expect(marksService.updateMarks(faculty, 1, 3, [{ studentId: 11, marksObtained: 5 }])).rejects.toThrow(ForbiddenError);
    expect(courseRepository.findComponent).not.toHaveBeenCalled();
  });
});
