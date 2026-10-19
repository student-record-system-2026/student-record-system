'use strict';

/**
 * Transaction boundary exposed to the Business/Service Layer.
 * Services call withTransaction(async (tx) => ...) and pass `tx` to repository calls;
 * they never see SQL or the pool itself (SADS 3.1: services never issue SQL).
 */
const { withTransaction } = require('./pool');

module.exports = { withTransaction };
