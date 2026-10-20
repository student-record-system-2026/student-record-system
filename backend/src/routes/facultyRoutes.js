'use strict';

/** SADS 4.3.3 Faculty Records (FR-3). Administrator only. */
const { Router } = require('express');
const a = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../services/roles');
const ctrl = require('../controllers/facultyController');

const router = Router();
router.use(requireRole(ROLES.ADMIN));

router.get('/', a(ctrl.list));
router.post('/', a(ctrl.create));
router.get('/:id', a(ctrl.get));
router.put('/:id', a(ctrl.update));
router.patch('/:id/deactivate', a(ctrl.deactivate));

module.exports = router;
