'use strict';

/** Unit tests - Authentication Service (FR-1, NFR-2; GitHub #10, #25). */
jest.mock('../../src/repositories/accountRepository');
jest.mock('../../src/repositories/studentRepository');
jest.mock('../../src/repositories/facultyRepository');

const bcrypt = require('bcryptjs');
const accountRepository = require('../../src/repositories/accountRepository');
const studentRepository = require('../../src/repositories/studentRepository');
const facultyRepository = require('../../src/repositories/facultyRepository');
const authService = require('../../src/services/authService');
const { UnauthenticatedError } = require('../../src/errors/AppError');

afterEach(() => jest.resetAllMocks());

describe('password hashing (NFR-2)', () => {
  test('hashPassword produces a salted bcrypt hash that verifies, never the plain text', async () => {
    const h1 = await authService.hashPassword('Student@123');
    const h2 = await authService.hashPassword('Student@123');
    expect(h1).toMatch(/^\$2[aby]\$/);
    expect(h1).not.toContain('Student@123');
    expect(h1).not.toBe(h2); // salted
    expect(await authService.verifyPassword('Student@123', h1)).toBe(true);
    expect(await authService.verifyPassword('WrongPass1', h1)).toBe(false);
  });
});

describe('authenticate (FR-1)', () => {
  const hash = bcrypt.hashSync('Student@123', 4);

  test('valid student credentials -> principal with studentId and /student redirect', async () => {
    accountRepository.findForLogin.mockResolvedValue({ id: 3, username: 'stu_pnair', role: 'STUDENT', passwordHash: hash });
    studentRepository.findByAccountId.mockResolvedValue({ id: 11, name: 'Priya Nair' });
    const { principal, redirectTo } = await authService.authenticate('stu_pnair', 'Student@123');
    expect(redirectTo).toBe('/student');
    expect(principal).toMatchObject({ role: 'STUDENT', studentId: 11, displayName: 'Priya Nair' });
    expect(principal).not.toHaveProperty('passwordHash');
  });

  test('valid faculty credentials -> /faculty', async () => {
    accountRepository.findForLogin.mockResolvedValue({ id: 2, username: 'fac_krao', role: 'FACULTY', passwordHash: hash });
    facultyRepository.findByAccountId.mockResolvedValue({ id: 7, name: 'Dr. Kavita Rao' });
    const { principal, redirectTo } = await authService.authenticate('fac_krao', 'Student@123');
    expect(redirectTo).toBe('/faculty');
    expect(principal.facultyId).toBe(7);
  });

  test('wrong password and unknown user both -> 401 with the same generic message', async () => {
    accountRepository.findForLogin.mockResolvedValue({ id: 3, username: 'stu_pnair', role: 'STUDENT', passwordHash: hash });
    await expect(authService.authenticate('stu_pnair', 'WrongPass1')).rejects.toThrow(UnauthenticatedError);
    accountRepository.findForLogin.mockResolvedValue(null);
    await expect(authService.authenticate('ghost', 'x')).rejects.toThrow('Invalid username or password.');
  });

  test('toPublicUser exposes no credential data', () => {
    const pub = authService.toPublicUser({ accountId: 1, username: 'admin01', role: 'ADMIN', displayName: 'Administrator', studentId: null, facultyId: null });
    expect(pub).toEqual({ username: 'admin01', role: 'ADMIN', displayName: 'Administrator', studentId: null, facultyId: null, dashboard: '/admin' });
  });
});
