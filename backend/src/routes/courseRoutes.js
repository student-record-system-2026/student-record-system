'use strict';

/**
 * SADS 4.3.4 Courses (FR-4), 4.3.5 Assignment/Enrollment (FR-5, FR-6),
 * 4.3.6 Attendance (FR-7) and 4.3.7 Marks (FR-9) - all course-scoped endpoints.
 * Role gates mirror the SADS "Allowed Role(s)" column; record-level scope
 * ("own course", "assigned course only") is enforced again in the services.
 */
const { Router } = require('express');
const a = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../services/roles');
const course = require('../controllers/courseController');
const assoc = require('../controllers/assignmentEnrollmentController');
const attendance = require('../controllers/attendanceController');
const marks = require('../controllers/marksController');

const { ADMIN, FACULTY, STUDENT } = ROLES;
const router = Router();

// 4.3.4 Courses
router.get('/', requireRole(ADMIN, FACULTY, STUDENT), a(course.list));
router.post('/', requireRole(ADMIN), a(course.create));
router.get('/:id', requireRole(ADMIN, FACULTY, STUDENT), a(course.get));
router.put('/:id', requireRole(ADMIN), a(course.update));
router.delete('/:id', requireRole(ADMIN), a(course.remove));

// 4.3.5 Faculty-Course Assignment
router.post('/:id/assignment', requireRole(ADMIN), a(assoc.assign));
router.get('/:id/assignment', requireRole(ADMIN, FACULTY, STUDENT), a(assoc.getAssignment));
router.put('/:id/assignment', requireRole(ADMIN), a(assoc.reassign));
router.delete('/:id/assignment', requireRole(ADMIN), a(assoc.unassign));

// 4.3.5 Student-Course Enrollment
router.post('/:id/enrollments', requireRole(ADMIN), a(assoc.enroll));
router.get('/:id/enrollments', requireRole(ADMIN, FACULTY), a(assoc.listEnrollments));
router.delete('/:id/enrollments/:studentId', requireRole(ADMIN), a(assoc.unenroll));

// 4.3.6 Attendance
router.post('/:id/attendance', requireRole(FACULTY), a(attendance.record));
router.put('/:id/attendance/:sessionDate', requireRole(FACULTY), a(attendance.update));
router.get('/:id/attendance', requireRole(FACULTY, ADMIN), a(attendance.listForCourse));

// 4.3.7 Marks
router.post('/:id/marks', requireRole(FACULTY), a(marks.enter));
router.put('/:id/marks/:componentId', requireRole(FACULTY), a(marks.update));
router.get('/:id/marks', requireRole(FACULTY, ADMIN), a(marks.listForCourse));

module.exports = router;
