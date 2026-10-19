'use strict';

/**
 * Uniform error handling (SADS 4.4, NFR-4). Every failure becomes
 *   { "error": { "code", "message", "details"? } }
 * with the matching HTTP status. Internal details (stack traces, SQL, schema) are never sent.
 */
const { AppError } = require('../errors/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No API endpoint for ${req.method} ${req.path}.` } });
}

// PostgreSQL error codes that can still surface (e.g. concurrent duplicate inserts).
const PG_MAP = {
  '23505': [409, 'CONFLICT', 'This record conflicts with an existing record.'],
  '23503': [409, 'CONFLICT', 'This operation conflicts with related records.'],
  '23514': [400, 'VALIDATION_ERROR', 'One or more values are outside the allowed range.'],
  '22P02': [400, 'VALIDATION_ERROR', 'One or more values have an invalid format.'],
  '22003': [400, 'VALIDATION_ERROR', 'A numeric value is out of range.'],
  '22001': [400, 'VALIDATION_ERROR', 'A value is too long.'],
  '22007': [400, 'VALIDATION_ERROR', 'A date value has an invalid format.'],
  '22008': [400, 'VALIDATION_ERROR', 'A date value is out of range.'],
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json({ error: body });
  }

  // Malformed JSON request body.
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON.' } });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }

  if (err && PG_MAP[err.code]) {
    const [status, code, message] = PG_MAP[err.code];
    return res.status(status).json({ error: { code, message } });
  }

  console.error('[api] unexpected error on', req.method, req.originalUrl, '\n', err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred. Please try again.' },
  });
}

module.exports = { notFoundHandler, errorHandler };
