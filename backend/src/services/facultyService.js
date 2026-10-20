'use strict';

/**
 * Faculty Service (FR-3). Only the Administrator may create, update or deactivate
 * faculty records (SRS 5.5); records are never deleted, only deactivated.
 */
const { withTransaction } = require('../db/unitOfWork');
const facultyRepository = require('../repositories/facultyRepository');
const accountRepository = require('../repositories/accountRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const authService = require('./authService');
const authz = require('./authorizationService');
const { ROLES } = require('./roles');
const { NotFoundError, ConflictError } = require('../errors/AppError');

/** Default username = local part of the contact email, e.g. kavita.rao@x.com -> kavita.rao */
function defaultUsername(email) {
  return email.split('@')[0].replace(/[^A-Za-z0-9._-]/g, '').slice(0, 50) || 'faculty';
}

async function list(actor, filters) {
  authz.assertRole(actor, ROLES.ADMIN);
  return facultyRepository.list(filters);
}

/** Faculty record plus assigned courses (the "faculty's view" of FR-5). */
async function get(actor, id) {
  authz.assertRole(actor, ROLES.ADMIN);
  const faculty = await facultyRepository.findById(id);
  if (!faculty) throw new NotFoundError('Faculty member not found.');
  const assignedCourses = await assignmentRepository.listCoursesByFaculty(id);
  return { ...faculty, assignedCourses };
}

async function create(actor, data) {
  authz.assertRole(actor, ROLES.ADMIN);
  const username = data.username || defaultUsername(data.email);
  const passwordHash = await authService.hashPassword(data.password);

  return withTransaction(async (tx) => {
    if (await accountRepository.usernameExists(username, tx)) {
      throw new ConflictError(`The username "${username}" is already taken.`, 'DUPLICATE_USERNAME');
    }
    if (await accountRepository.emailExists(data.email, null, tx)) {
      throw new ConflictError(`The email ${data.email} is already used by another account.`, 'DUPLICATE_EMAIL');
    }
    const account = await accountRepository.create(
      { username, email: data.email, passwordHash, role: ROLES.FACULTY }, tx
    );
    return facultyRepository.create({ ...data, accountId: account.id }, tx);
  });
}

async function update(actor, id, data) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    const existing = await facultyRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Faculty member not found.');
    if (await accountRepository.emailExists(data.email, existing.accountId, tx)) {
      throw new ConflictError(`The email ${data.email} is already used by another account.`, 'DUPLICATE_EMAIL');
    }
    await accountRepository.updateEmail(existing.accountId, data.email, tx);
    return facultyRepository.update(id, { ...data, status: data.status || existing.status }, tx);
  });
}

/** Deactivate: record retained, excluded from new course assignments (FR-3). Idempotent. */
async function deactivate(actor, id) {
  authz.assertRole(actor, ROLES.ADMIN);
  return withTransaction(async (tx) => {
    const existing = await facultyRepository.findById(id, tx);
    if (!existing) throw new NotFoundError('Faculty member not found.');
    return facultyRepository.setStatus(id, 'INACTIVE', tx);
  });
}

module.exports = { list, get, create, update, deactivate, defaultUsername };
