'use strict';

/**
 * Authentication Service (FR-1, FR-14, NFR-2, NFR-8).
 * - Passwords are hashed with bcrypt before persistence and verified against the hash;
 *   plain-text passwords are never stored or returned.
 * - Builds the session principal (identity + role + linked student/faculty id).
 */
const bcrypt = require('bcryptjs');
const config = require('../config');
const accountRepository = require('../repositories/accountRepository');
const studentRepository = require('../repositories/studentRepository');
const facultyRepository = require('../repositories/facultyRepository');
const { UnauthenticatedError } = require('../errors/AppError');
const { ROLES, DASHBOARD_PATH } = require('./roles');

const INVALID_CREDENTIALS_MESSAGE = 'Invalid username or password.';

// Used to keep response time similar whether or not the username exists.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 4);

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Build the principal stored in the server-side session. */
async function buildPrincipal(account) {
  const principal = {
    accountId: account.id,
    username: account.username,
    role: account.role,
    displayName: 'Administrator',
    studentId: null,
    facultyId: null,
  };
  if (account.role === ROLES.STUDENT) {
    const s = await studentRepository.findByAccountId(account.id);
    if (!s) throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS');
    principal.studentId = s.id;
    principal.displayName = s.name;
  } else if (account.role === ROLES.FACULTY) {
    const f = await facultyRepository.findByAccountId(account.id);
    if (!f) throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS');
    principal.facultyId = f.id;
    principal.displayName = f.name;
  }
  return principal;
}

/**
 * Authenticate with username/email + password (SADS Sequence Diagram 1).
 * @returns {{ principal, redirectTo }}
 * @throws UnauthenticatedError (401) with a generic message on any failure.
 */
async function authenticate(identifier, password) {
  const account = await accountRepository.findForLogin(identifier);
  const ok = await verifyPassword(password, account ? account.passwordHash : DUMMY_HASH);
  if (!account || !ok) {
    throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS');
  }
  const principal = await buildPrincipal(account);
  return { principal, redirectTo: DASHBOARD_PATH[principal.role] };
}

/** Public view of a principal, safe to send to the client (no hashes, no internals). */
function toPublicUser(principal) {
  return {
    username: principal.username,
    role: principal.role,
    displayName: principal.displayName,
    studentId: principal.studentId,
    facultyId: principal.facultyId,
    dashboard: DASHBOARD_PATH[principal.role],
  };
}

module.exports = { hashPassword, verifyPassword, authenticate, toPublicUser, INVALID_CREDENTIALS_MESSAGE };
