'use strict';

/** Unit tests - request validation (NFR-4, GitHub #27). Equivalence partitions + boundaries (Test Plan 4.3). */
const { validate, validateArray, parseId, isValidCalendarDate } = require('../../src/validation/validator');
const schemas = require('../../src/validation/schemas');
const { ValidationError } = require('../../src/errors/AppError');

const validStudent = {
  name: 'Priya Nair', rollNumber: 'pes1ug24cs099', email: 'Priya.Nair@Example.com',
  department: 'CSE', batch: '2024', password: 'Welcome@123',
};

describe('validator - student create schema', () => {
  test('valid input is normalised (roll number upper-cased, email lower-cased)', () => {
    const v = validate(validStudent, schemas.studentCreate);
    expect(v.rollNumber).toBe('PES1UG24CS099');
    expect(v.email).toBe('priya.nair@example.com');
    expect(v.phone).toBeNull();
  });

  test('unknown fields are dropped (never reach the database)', () => {
    const v = validate({ ...validStudent, role: 'ADMIN', status: 'INACTIVE' }, schemas.studentCreate);
    expect(v).not.toHaveProperty('role');
    expect(v).not.toHaveProperty('status');
  });

  test('missing required fields produce one error per field, in SADS envelope shape', () => {
    try {
      validate({}, schemas.studentCreate);
      throw new Error('expected failure');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.status).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details.map((d) => d.field)).toEqual(['name', 'rollNumber', 'email', 'department', 'batch', 'password']);
      expect(err.details[1]).toEqual({ field: 'rollNumber', issue: 'missing', message: 'Roll number is required.' });
    }
  });

  test('whitespace-only counts as missing', () => {
    expect(() => validate({ ...validStudent, name: '   ' }, schemas.studentCreate)).toThrow('Name is required.');
  });

  test.each([
    ['email', 'not-an-email'],
    ['batch', '24'],
    ['batch', '1850'],
    ['rollNumber', 'PES-1 UG'],
    ['name', '1234'],
    ['phone', 'abc'],
    ['password', 'short1'],
    ['password', 'NoDigitsHere'],
  ])('invalid %s (%s) is rejected', (field, value) => {
    expect(() => validate({ ...validStudent, [field]: value }, schemas.studentCreate)).toThrow(ValidationError);
  });
});

describe('validator - numeric boundaries', () => {
  const marks = schemas.marksEntry;
  test.each([[0, true], [20, true], [17.5, true], [17.25, true], [-0.01, false], [17.255, false], ['x', false], [true, false]])(
    'marksObtained %p valid=%p', (value, ok) => {
      const run = () => validate({ studentId: 1, marksObtained: value }, marks);
      if (ok) expect(run().marksObtained).toBe(value);
      else expect(run).toThrow(ValidationError);
    }
  );

  test.each([[0, false], [1, true], [10, true], [11, false], [3.5, false]])('credits %p valid=%p', (credits, ok) => {
    const run = () => validate({ code: 'UE24CS301', name: 'DS', credits }, schemas.courseFields);
    if (ok) expect(run().credits).toBe(credits);
    else expect(run).toThrow(ValidationError);
  });
});

describe('validator - dates and arrays', () => {
  test.each([['2026-09-10', true], ['2024-02-29', true], ['2026-02-30', false], ['2026-13-01', false], ['10-09-2026', false]])(
    'calendar date %s valid=%p', (d, ok) => expect(isValidCalendarDate(d)).toBe(ok)
  );

  test('session date in the future is rejected', () => {
    expect(() => validate({ sessionDate: '2999-01-01' }, { sessionDate: schemas.sessionDate })).toThrow('cannot be in the future');
  });

  test('attendance status partition: PRESENT/ABSENT accepted (case-insensitive), anything else rejected', () => {
    expect(validate({ studentId: 1, status: 'present' }, schemas.attendanceRecord).status).toBe('PRESENT');
    expect(() => validate({ studentId: 1, status: 'LATE' }, schemas.attendanceRecord)).toThrow(ValidationError);
  });

  test('validateArray rejects empty arrays and duplicate keys', () => {
    expect(validateArray([], 'records', 'Records', schemas.attendanceRecord).errors[0].issue).toBe('missing');
    const dup = validateArray(
      [{ studentId: 1, status: 'PRESENT' }, { studentId: 1, status: 'ABSENT' }],
      'records', 'Records', schemas.attendanceRecord, { uniqueBy: 'studentId' }
    );
    expect(dup.errors[0]).toMatchObject({ field: 'records[1].studentId', issue: 'duplicate' });
  });

  test('parseId accepts positive integers only', () => {
    expect(parseId('42')).toBe(42);
    for (const bad of ['0', '-1', '1.5', 'abc', '1e3', '']) expect(() => parseId(bad)).toThrow(ValidationError);
  });
});
