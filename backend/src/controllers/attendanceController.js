'use strict';

/**
 * Attendance Controller (FR-7; SADS Sequence Diagram 2).
 *   POST /api/courses/:id/attendance                 { sessionDate, records: [{ studentId, status }] }
 *   PUT  /api/courses/:id/attendance/:sessionDate    { records: [...] }
 *   GET  /api/courses/:id/attendance[?date=YYYY-MM-DD]
 * (Student self view GET /api/students/:id/attendance lives in studentController.)
 */
const attendanceService = require('../services/attendanceService');
const { validate, validateArray, throwIfErrors, parseId, checkValue } = require('../validation/validator');
const schemas = require('../validation/schemas');
const { ValidationError } = require('../errors/AppError');

function parseDate(raw, field, { notFuture = true, required = true } = {}) {
  const res = checkValue(raw, { ...schemas.sessionDate, notFuture, required });
  if (res.issue) throw new ValidationError(res.message, [{ field, issue: res.issue, message: res.message }]);
  return res.value;
}

function parseRecords(body, errors) {
  const records = body && typeof body === 'object' ? body.records : undefined;
  const res = validateArray(records, 'records', 'Attendance records', schemas.attendanceRecord, { uniqueBy: 'studentId' });
  errors.push(...res.errors);
  return res.value;
}

async function record(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const errors = [];
  let sessionDate;
  try {
    sessionDate = parseDate(req.body && req.body.sessionDate, 'sessionDate');
  } catch (e) {
    errors.push(...e.details);
  }
  const records = parseRecords(req.body, errors);
  throwIfErrors(errors);
  const result = await attendanceService.recordSession(req.user, courseId, sessionDate, records);
  res.status(201).json({ ...result, message: 'Attendance saved.' });
}

async function update(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const sessionDate = parseDate(req.params.sessionDate, 'sessionDate');
  const errors = [];
  const records = parseRecords(req.body, errors);
  throwIfErrors(errors);
  const result = await attendanceService.updateSession(req.user, courseId, sessionDate, records);
  res.json({ ...result, message: 'Attendance updated.' });
}

async function listForCourse(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const date = req.query.date ? parseDate(req.query.date, 'date', { notFuture: false }) : null;
  res.json(await attendanceService.getCourseAttendance(req.user, courseId, date));
}

module.exports = { record, update, listForCourse };
