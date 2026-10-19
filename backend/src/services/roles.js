'use strict';

/** The three roles supported by Version 1.0 (SRS 2.5, SADS 3.9). */
const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  FACULTY: 'FACULTY',
  STUDENT: 'STUDENT',
});

/** Role-based dashboard redirect targets returned at login (FR-1, SADS 4.2.1). */
const DASHBOARD_PATH = Object.freeze({
  ADMIN: '/admin',
  FACULTY: '/faculty',
  STUDENT: '/student',
});

module.exports = { ROLES, DASHBOARD_PATH };
