'use strict';

/** SADS 4.3.2 Student Records (FR-2) + student views of 4.3.6 / 4.3.7 (FR-8, FR-10). */
const { Router } = require('express');
const a = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../services/roles');
const ctrl = require('../controllers/studentController');

const router = Router();
const admin = requireRole(ROLES.ADMIN);
const student = requireRole(ROLES.STUDENT);

router.get('/', admin, a(ctrl.list));
router.post('/', admin, a(ctrl.create));
router.get('/:id', admin, a(ctrl.get));
router.put('/:id', admin, a(ctrl.update));
router.patch('/:id/deactivate', admin, a(ctrl.deactivate));
router.get('/:id/attendance', student, a(ctrl.attendance)); // Student (self only - enforced in service)
router.get('/:id/marks', student, a(ctrl.marks)); // Student (self only - enforced in service)

module.exports = router;
