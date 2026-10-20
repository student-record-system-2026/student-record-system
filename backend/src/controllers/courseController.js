'use strict';

/**
 * Course Controller (FR-4).
 *   GET/POST /api/courses, GET/PUT/DELETE /api/courses/:id
 * Assessment components are part of the course payload: components: [{ id?, name, maxMarks }].
 */
const courseService = require('../services/courseService');
const { validate, validateArray, throwIfErrors, parseId } = require('../validation/validator');
const schemas = require('../validation/schemas');

/** Parse the optional components array. Returns undefined when not supplied. */
function parseComponents(body, errors) {
  if (body === null || typeof body !== 'object' || body.components === undefined) return undefined;
  if (Array.isArray(body.components) && body.components.length === 0) return [];
  const res = validateArray(body.components, 'components', 'Assessment components', schemas.component, {
    maxItems: 20,
  });
  errors.push(...res.errors);
  return res.value;
}

async function list(req, res) {
  const filters = validate(req.query, schemas.listQuery);
  res.json({ courses: await courseService.list(req.user, filters) });
}

async function get(req, res) {
  res.json({ course: await courseService.get(req.user, parseId(req.params.id, 'Course id')) });
}

async function create(req, res) {
  const { value, errors } = validate(req.body, schemas.courseFields, { collect: true });
  const components = parseComponents(req.body, errors);
  throwIfErrors(errors);
  const course = await courseService.create(req.user, value, components || []);
  res.status(201).json({ course, message: 'Course created.' });
}

async function update(req, res) {
  const id = parseId(req.params.id, 'Course id');
  const { value, errors } = validate(req.body, schemas.courseUpdate, { collect: true });
  const components = parseComponents(req.body, errors);
  throwIfErrors(errors);
  const course = await courseService.update(req.user, id, value, components);
  res.json({ course, message: 'Course updated.' });
}

async function remove(req, res) {
  const id = parseId(req.params.id, 'Course id');
  await courseService.remove(req.user, id);
  res.json({ deleted: true, message: 'Course permanently deleted.' });
}

module.exports = { list, get, create, update, remove };
