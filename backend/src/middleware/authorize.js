'use strict';

/**
 * Route-level RBAC check (SADS 3.6 SO-3): maps the session's role to the endpoints it may
 * invoke (SADS 4.3 "Allowed Role(s)") before the request reaches the Business/Service Layer.
 * Record-level scope (assigned course / own record) is re-checked inside the services.
 */
const authz = require('../services/authorizationService');

function requireRole(...roles) {
  return (req, _res, next) => {
    try {
      authz.assertRole(req.user, ...roles);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireRole };
