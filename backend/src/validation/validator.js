'use strict';

/**
 * Minimal declarative request validator used by the Controller/API Layer (SADS 4.4, NFR-4).
 * Collects ALL field problems and throws a single ValidationError whose `details`
 * array follows the SADS envelope: [{ field, issue, message }].
 */
const { ValidationError } = require('../errors/AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function isValidCalendarDate(s) {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today's date (local server time) as YYYY-MM-DD. */
function todayIso() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Validate one value against a rule. Returns { value } or { issue, message }.
 * Rule shape: { type, label, required, min, max, pattern, patternMessage, values, case, default, notFuture }
 */
function checkValue(raw, rule) {
  const label = rule.label;
  if (isBlank(raw)) {
    if (rule.required) return { issue: 'missing', message: `${label} is required.` };
    return { value: rule.default !== undefined ? rule.default : null };
  }

  switch (rule.type) {
    case 'string':
    case 'email': {
      if (typeof raw !== 'string' && typeof raw !== 'number') {
        return { issue: 'invalid_type', message: `${label} must be text.` };
      }
      let v = String(raw).trim();
      if (rule.type === 'string') v = v.replace(/\s+/g, ' '); // collapse internal whitespace
      if (rule.case === 'upper') v = v.toUpperCase();
      if (rule.case === 'lower') v = v.toLowerCase();
      if (rule.min && v.length < rule.min) {
        return { issue: 'too_short', message: `${label} must be at least ${rule.min} characters.` };
      }
      if (rule.max && v.length > rule.max) {
        return { issue: 'too_long', message: `${label} must be at most ${rule.max} characters.` };
      }
      if (rule.type === 'email' && !EMAIL_RE.test(v)) {
        return { issue: 'invalid_format', message: `${label} must be a valid email address.` };
      }
      if (rule.pattern && !rule.pattern.test(v)) {
        return { issue: 'invalid_format', message: rule.patternMessage || `${label} has an invalid format.` };
      }
      return { value: v };
    }
    case 'password': {
      if (typeof raw !== 'string') return { issue: 'invalid_type', message: `${label} must be text.` };
      if (raw.length < 8) return { issue: 'too_short', message: `${label} must be at least 8 characters.` };
      if (raw.length > 72) return { issue: 'too_long', message: `${label} must be at most 72 characters.` };
      if (!/[A-Za-z]/.test(raw) || !/\d/.test(raw)) {
        return { issue: 'too_weak', message: `${label} must contain at least one letter and one digit.` };
      }
      return { value: raw };
    }
    case 'int': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isInteger(n)) return { issue: 'invalid_type', message: `${label} must be a whole number.` };
      if (rule.min !== undefined && n < rule.min) {
        return { issue: 'out_of_range', message: `${label} must be at least ${rule.min}.` };
      }
      if (rule.max !== undefined && n > rule.max) {
        return { issue: 'out_of_range', message: `${label} must be at most ${rule.max}.` };
      }
      return { value: n };
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (typeof raw === 'boolean' || !Number.isFinite(n)) {
        return { issue: 'invalid_type', message: `${label} must be a number.` };
      }
      if (rule.min !== undefined && n < rule.min) {
        return { issue: 'out_of_range', message: `${label} must be at least ${rule.min}.` };
      }
      if (rule.exclusiveMin !== undefined && n <= rule.exclusiveMin) {
        return { issue: 'out_of_range', message: `${label} must be greater than ${rule.exclusiveMin}.` };
      }
      if (rule.max !== undefined && n > rule.max) {
        return { issue: 'out_of_range', message: `${label} must be at most ${rule.max}.` };
      }
      if (rule.decimals !== undefined && Math.round(n * 10 ** rule.decimals) !== n * 10 ** rule.decimals) {
        return { issue: 'invalid_format', message: `${label} may have at most ${rule.decimals} decimal places.` };
      }
      return { value: n };
    }
    case 'enum': {
      const v = String(raw).trim().toUpperCase();
      if (!rule.values.includes(v)) {
        return { issue: 'invalid_value', message: `${label} must be one of: ${rule.values.join(', ')}.` };
      }
      return { value: v };
    }
    case 'date': {
      const v = String(raw).trim();
      if (!isValidCalendarDate(v)) {
        return { issue: 'invalid_format', message: `${label} must be a valid date (YYYY-MM-DD).` };
      }
      if (rule.notFuture && v > todayIso()) {
        return { issue: 'out_of_range', message: `${label} cannot be in the future.` };
      }
      return { value: v };
    }
    default:
      throw new Error(`Unknown rule type: ${rule.type}`);
  }
}

/**
 * Validate an object against a schema { field: rule }. Unknown fields are ignored (never persisted).
 * @param {object} input request body
 * @param {object} schema
 * @param {string} [prefix] field path prefix for nested items, e.g. "records[0]."
 * @returns {{ value: object, errors: Array }} when `collect` is true; otherwise throws.
 */
function validate(input, schema, { prefix = '', collect = false } = {}) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const value = {};
  const errors = [];
  for (const [field, rule] of Object.entries(schema)) {
    const res = checkValue(body[field], rule);
    if (res.issue) errors.push({ field: prefix + field, issue: res.issue, message: res.message });
    else value[field] = res.value;
  }
  if (collect) return { value, errors };
  if (errors.length) throw new ValidationError(errors[0].message, errors);
  return value;
}

/**
 * Validate a required, non-empty array of objects against an item schema.
 * `uniqueBy` rejects duplicate entries for the same key (e.g. the same studentId twice).
 */
function validateArray(input, field, label, itemSchema, { uniqueBy, maxItems = 1000 } = {}) {
  if (!Array.isArray(input) || input.length === 0) {
    return {
      value: [],
      errors: [{ field, issue: 'missing', message: `${label} must contain at least one entry.` }],
    };
  }
  if (input.length > maxItems) {
    return { value: [], errors: [{ field, issue: 'too_long', message: `${label} has too many entries.` }] };
  }
  const value = [];
  const errors = [];
  const seen = new Set();
  input.forEach((item, i) => {
    const res = validate(item, itemSchema, { prefix: `${field}[${i}].`, collect: true });
    errors.push(...res.errors);
    if (!res.errors.length) {
      if (uniqueBy) {
        const key = res.value[uniqueBy];
        if (seen.has(key)) {
          errors.push({ field: `${field}[${i}].${uniqueBy}`, issue: 'duplicate', message: `${label} contains a duplicate entry.` });
        }
        seen.add(key);
      }
      value.push(res.value);
    }
  });
  return { value, errors };
}

/** Throw a combined ValidationError if any errors were collected. */
function throwIfErrors(errors) {
  if (errors.length) throw new ValidationError(errors[0].message, errors);
}

/** Validate a positive integer route parameter (e.g. :id). */
function parseId(raw, label = 'Id') {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || String(raw).trim() !== String(n)) {
    throw new ValidationError(`${label} must be a positive whole number.`, [
      { field: label, issue: 'invalid_format', message: `${label} must be a positive whole number.` },
    ]);
  }
  return n;
}

module.exports = { validate, validateArray, throwIfErrors, parseId, isValidCalendarDate, todayIso, checkValue };
