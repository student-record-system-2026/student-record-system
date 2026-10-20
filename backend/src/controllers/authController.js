'use strict';

/** Authentication Controller - POST /api/auth/login, POST /api/auth/logout (FR-1, FR-14, NFR-8). */
const config = require('../config');
const authService = require('../services/authService');
const { validate } = require('../validation/validator');
const schemas = require('../validation/schemas');

function promisify(fn) {
  return new Promise((resolve, reject) => fn((err) => (err ? reject(err) : resolve())));
}

async function login(req, res) {
  const { username, password } = validate(req.body, schemas.login);
  const { principal, redirectTo } = await authService.authenticate(username, password);

  // New session id on every login (prevents session fixation).
  await promisify((cb) => req.session.regenerate(cb));
  req.session.user = principal;
  await promisify((cb) => req.session.save(cb));

  res.json({ user: authService.toPublicUser(principal), redirectTo });
}

/** Destroy the server-side session; the cookie can never be used again (NFR-8). */
async function logout(req, res) {
  await promisify((cb) => req.session.destroy(cb));
  res.clearCookie(config.session.cookieName, { path: '/' });
  res.json({ message: 'You have been logged out.' });
}

/** Current session's user - lets the browser UI restore state on reload (supports FR-1/NFR-8). */
async function currentSession(req, res) {
  res.json({ user: authService.toPublicUser(req.user) });
}

module.exports = { login, logout, currentSession };
