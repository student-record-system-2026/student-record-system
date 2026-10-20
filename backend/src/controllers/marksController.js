'use strict';

/**
 * Marks Controller (FR-9).
 *   POST /api/courses/:id/marks                { componentId, marks: [{ studentId, marksObtained }] }
 *   PUT  /api/courses/:id/marks/:componentId   { marks: [...] }
 *   GET  /api/courses/:id/marks
 * (Student self view GET /api/students/:id/marks lives in studentController.)
 */
const marksService = require('../services/marksService');
const { validate, validateArray, throwIfErrors, parseId } = require('../validation/validator');
const schemas = require('../validation/schemas');

function parseEntries(body, errors) {
  const marks = body && typeof body === 'object' ? body.marks : undefined;
  const res = validateArray(marks, 'marks', 'Marks entries', schemas.marksEntry, { uniqueBy: 'studentId' });
  errors.push(...res.errors);
  return res.value;
}

async function enter(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const { value, errors } = validate(
    req.body, { componentId: { type: 'int', label: 'Assessment component', required: true, min: 1 } }, { collect: true }
  );
  const entries = parseEntries(req.body, errors);
  throwIfErrors(errors);
  const result = await marksService.enterMarks(req.user, courseId, value.componentId, entries);
  res.status(201).json({ ...result, message: 'Marks saved.' });
}

async function update(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  const componentId = parseId(req.params.componentId, 'Component id');
  const errors = [];
  const entries = parseEntries(req.body, errors);
  throwIfErrors(errors);
  const result = await marksService.updateMarks(req.user, courseId, componentId, entries);
  res.json({ ...result, message: 'Marks updated.' });
}

async function listForCourse(req, res) {
  const courseId = parseId(req.params.id, 'Course id');
  res.json(await marksService.getCourseMarks(req.user, courseId));
}

module.exports = { enter, update, listForCourse };
