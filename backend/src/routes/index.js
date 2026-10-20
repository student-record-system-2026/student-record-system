'use strict';

/** API router: mounts every feature router under /api (SADS 4.3). */
const { Router } = require('express');
const a = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../services/roles');
const profileDashboard = require('../controllers/profileDashboardController');

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.use('/auth', require('./authRoutes'));

// Everything below requires an authenticated session (SADS 4.3: "All endpoints below require
// an authenticated session established via /api/auth/login").
router.use(requireAuth);
router.use('/students', require('./studentRoutes'));
router.use('/faculty', require('./facultyRoutes'));
router.use('/courses', require('./courseRoutes'));

// 4.3.8 Profile and Dashboard
router.get('/profile', requireRole(ROLES.FACULTY, ROLES.STUDENT), a(profileDashboard.profile));
router.get('/dashboard', requireRole(ROLES.ADMIN, ROLES.FACULTY, ROLES.STUDENT), a(profileDashboard.dashboard));

module.exports = router;
