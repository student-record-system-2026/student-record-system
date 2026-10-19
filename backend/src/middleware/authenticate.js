'use strict';

/**
 * Authentication gate for every protected endpoint (SADS 4.5, NFR-8).
 * The session is server-side (PostgreSQL store); after logout the session row is destroyed,
 * so a replayed cookie resolves to no user and is rejected with 401.
 */
const { UnauthenticatedError } = require('../errors/AppError');

function requireAuth(req, _res, next) {
  const user = req.session && req.session.user;
  if (!user) {
    return next(new UnauthenticatedError('Your session has ended or you are not logged in. Please log in.'));
  }
  req.user = user;
  return next();
}

module.exports = { requireAuth };
