'use strict';

/**
 * Student Service (FR-2). Only the Administrator may create, update or deactivate
 * student records (SRS 5.5); records are never deleted, only deactivated.
 */
const { withTransaction } = require('../db/unitOfWork');
const studentRepository = require('../repositories/studentRepository');
const accountRepository = require('../repositories/accountRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');
const authService = require('./authService');
const authz = require('./authorizationService');
const { ROLES } = require('./roles');
const { NotFoundError, ConflictError } = require('../errors/AppError');

async function list(actor, filters) {
  authz.assertRole(actor, ROLES.ADMIN);
  return studentRepository.list(filters);
}

/** Student record plus the student's active enrollments (the "student's view" of FR-6). */
async function get(actor, id) {
  authz.assertRole(actor, ROLES.ADMIN);
  const student = await studentRepository.findById(id);
  if (!student) throw new NotFoundError('Student not found.');
  const enrollments = await enrollmentRepository.listActiveByStudent(id);
  return { ...student, enrollments };
}

async function create(actor, data) {
  authz.assertRole(actor, ROLES.ADMIN);
  const username = data.username || data.rollNumber.toLowerCase();
  const passwordHash = await authService.hashPassword(data.password);

  return withTransaction(async (tx) => {
    if (await studentRepository.rollNumberExists(data.rollNumber, null, tx)) {
      throw new ConflictError(`A student with roll number ${data.rollNumber} already exists.`, 'DUPLICATE_ROLL_NUMBER');
    }
    if (await accountRepository.usernameExists(username, tx)) {
      throw new ConflictError(`The username "${username}" is already taken.`, 'DUPLICATE_USERNAME');
    }
    if (await accountRepository.emailExists(data.email, null, tx)) {
      throw new ConflictError(`The email ${data.email} is already used by another account.`, 'DUPLICATE_EMAIL');
    }
    const account = await accountRepository.create(
      { username, email: data.email, passwordHash, role: ROLES.STUDENT }, tx
    );
    return studentRepository.create({ ...data, accountId: account.id }, tx);
  });
}

async function update(actor, id, data) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    const existing = await studentRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Student not found.');
    if (await studentRepository.rollNumberExists(data.rollNumber, id, tx)) {
      throw new ConflictError(`A student with roll number ${data.rollNumber} already exists.`, 'DUPLICATE_ROLL_NUMBER');
    }
    if (await accountRepository.emailExists(data.email, existing.accountId, tx)) {
      throw new ConflictError(`The email ${data.email} is already used by another account.`, 'DUPLICATE_EMAIL');
    }
    await accountRepository.updateEmail(existing.accountId, data.email, tx);
    return studentRepository.update(id, { ...data, status: data.status || existing.status }, tx);
  });
}

/** Deactivate: record retained, excluded from new enrollments (FR-2). Idempotent. */
async function deactivate(actor, id) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    const existing = await studentRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Student not found.');
    return studentRepository.setStatus(id, 'INACTIVE', tx);
  });
}

module.exports = { list, get, create, update, deactivate };
