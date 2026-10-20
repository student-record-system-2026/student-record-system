'use strict';

/**
 * Student Controller (FR-2) + student self-service views (FR-8, FR-10).
 *   GET/POST /api/students, GET/PUT /api/students/:id, PATCH /api/students/:id/deactivate
 *   GET /api/students/:id/attendance, GET /api/students/:id/marks
 */
const studentService = require('../services/studentService');
const attendanceService = require('../services/attendanceService');
const marksService = require('../services/marksService');
const { validate, parseId } = require('../validation/validator');
const schemas = require('../validation/schemas');

function optionalCourseId(q) {
  return q.courseId === undefined || q.courseId === '' ? null : parseId(q.courseId, 'courseId');
}

async function list(req, res) {
  const filters = validate(req.query, schemas.listQuery);
  res.json({ students: await studentService.list(req.user, filters) });
}

async function get(req, res) {
  res.json({ student: await studentService.get(req.user, parseId(req.params.id, 'Student id')) });
}

async function create(req, res) {
  const data = validate(req.body, schemas.studentCreate);
  res.status(201).json({ student: await studentService.create(req.user, data), message: 'Student record created.' });
}

async function update(req, res) {
  const id = parseId(req.params.id, 'Student id');
  const data = validate(req.body, schemas.studentUpdate);
  res.json({ student: await studentService.update(req.user, id, data), message: 'Student record updated.' });
}

async function deactivate(req, res) {
  const id = parseId(req.params.id, 'Student id');
  res.json({ student: await studentService.deactivate(req.user, id), message: 'Student record deactivated.' });
}

async function attendance(req, res) {
  const id = parseId(req.params.id, 'Student id');
  res.json(await attendanceService.getStudentAttendance(req.user, id, optionalCourseId(req.query)));
}

async function marks(req, res) {
  const id = parseId(req.params.id, 'Student id');
  res.json(await marksService.getStudentMarks(req.user, id, optionalCourseId(req.query)));
}

module.exports = { list, get, create, update, deactivate, attendance, marks };
