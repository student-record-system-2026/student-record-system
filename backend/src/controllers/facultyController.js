'use strict';

/**
 * Faculty Controller (FR-3).
 *   GET/POST /api/faculty, GET/PUT /api/faculty/:id, PATCH /api/faculty/:id/deactivate
 */
const facultyService = require('../services/facultyService');
const { validate, parseId } = require('../validation/validator');
const schemas = require('../validation/schemas');

async function list(req, res) {
  const filters = validate(req.query, schemas.listQuery);
  res.json({ faculty: await facultyService.list(req.user, filters) });
}

async function get(req, res) {
  res.json({ faculty: await facultyService.get(req.user, parseId(req.params.id, 'Faculty id')) });
}

async function create(req, res) {
  const data = validate(req.body, schemas.facultyCreate);
  res.status(201).json({ faculty: await facultyService.create(req.user, data), message: 'Faculty record created.' });
}

async function update(req, res) {
  const id = parseId(req.params.id, 'Faculty id');
  const data = validate(req.body, schemas.facultyUpdate);
  res.json({ faculty: await facultyService.update(req.user, id, data), message: 'Faculty record updated.' });
}

async function deactivate(req, res) {
  const id = parseId(req.params.id, 'Faculty id');
  res.json({ faculty: await facultyService.deactivate(req.user, id), message: 'Faculty record deactivated.' });
}

module.exports = { list, get, create, update, deactivate };
