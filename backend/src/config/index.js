'use strict';

/**
 * Central configuration. Values come from environment variables (backend/.env),
 * with safe local-development defaults.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const isTest = process.env.NODE_ENV === 'test';

const config = {
  env: process.env.NODE_ENV || 'development',
  isTest,
  port: Number(process.env.PORT) || 4000,
  databaseUrl: isTest
    ? process.env.TEST_DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/student_record_system_test'
    : process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/student_record_system',
  session: {
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-session-secret',
    ttlMinutes: Number(process.env.SESSION_TTL_MINUTES) || 480,
    cookieSecure: String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
    cookieName: 'srs.sid',
  },
  // Lower work factor in tests keeps the suite fast; still a real bcrypt hash.
  bcryptRounds: isTest ? 4 : Number(process.env.BCRYPT_ROUNDS) || 10,
};

module.exports = config;
