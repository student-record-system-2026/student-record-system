'use strict';

/** SADS 4.3.1 Authentication (FR-1, FR-14). */
const { Router } = require('express');
const a = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/authenticate');
const ctrl = require('../controllers/authController');

const router = Router();

router.post('/login', a(ctrl.login)); // All (unauthenticated)
router.post('/logout', requireAuth, a(ctrl.logout)); // Administrator, Faculty, Student
router.get('/session', requireAuth, a(ctrl.currentSession)); // supporting endpoint for the browser UI

module.exports = router;
