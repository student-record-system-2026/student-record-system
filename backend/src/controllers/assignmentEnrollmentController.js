'use strict';

/**
 * Assignment / Enrollment Controller (FR-5, FR-6).
 *   POST/GET/PUT/DELETE /api/courses/:id/assignment
 *   POST/GET            /api/courses/:id/enrollments
 *   DELETE              /api/courses/:id/enrollments/:studentId
 */
const service = require('../services/assignmentEnrollmentService');
const { validate, parseId } = require('../validation/validator');
const schemas = require('../validation/schemas');

async function getAssignment(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  res.json({ assignment: await service.getAssignment(req.user, courseId) });
}

async function assign(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const { facultyId } = validate(req.body, schemas.assignment);
  const assignment = await service.assign(req.user, courseId, facultyId);
  res.status(201).json({ assignment, message: 'Faculty assigned to course.' });
}

async function reassign(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const { facultyId } = validate(req.body, schemas.assignment);
  res.json({ assignment: await service.reassign(req.user, courseId, facultyId), message: 'Assignment updated.' });
}

async function unassign(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  await service.unassign(req.user, courseId);
  res.json({ removed: true, message: 'Assignment removed.' });
}

async function listEnrollments(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  res.json({ enrollments: await service.listEnrollments(req.user, courseId) });
}

async function enroll(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const { studentId } = validate(req.body, schemas.enrollment);
  const enrollment = await service.enroll(req.user, courseId, studentId);
  res.status(201).json({ enrollment, message: 'Student enrolled in course.' });
}

async function unenroll(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const studentId = parseId(req.params.studentId, 'Student id');
  await service.unenroll(req.user, courseId, studentId);
  res.json({ removed: true, message: 'Enrollment removed.' });
}

module.exports = { getAssignment, assign, reassign, unassign, listEnrollments, enroll, unenroll };
