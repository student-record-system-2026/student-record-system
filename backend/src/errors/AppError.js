'use strict';

/**
 * Typed application errors. Each maps to one row of the SADS 4.4 error table and is
 * converted to the standard JSON error envelope by middleware/errorHandler.js.
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** 400 - missing or invalid field (NFR-4). `details` = [{ field, issue }]. */
class ValidationError extends AppError {
  constructor(message, details = []) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/** 401 - no session, or an expired/terminated session (NFR-8), or bad credentials (FR-1). */
class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required. Please log in.', code = 'UNAUTHENTICATED') {
    super(401, code, message);
  }
}

/** 403 - authenticated but not authorized (NFR-7, SO-3, SRS 5.5). */
class ForbiddenError extends AppError {
  constructor(message = 'You are not authorized to perform this operation.') {
    super(403, 'FORBIDDEN', message);
  }
}

/** 404 - record does not exist. */
class NotFoundError extends AppError {
  constructor(message = 'Record not found.') {
    super(404, 'NOT_FOUND', message);
  }
}

/** 409 - duplicate / conflicting operation or invalid state transition. */
class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT', details) {
    super(409, code, message, details);
  }
}

/** 503 - the Data Access Layer cannot reach the database. */
class ServiceUnavailableError extends AppError {
  constructor(message = 'The service is temporarily unavailable. Please try again shortly.') {
    super(503, 'SERVICE_UNAVAILABLE', message);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
};
