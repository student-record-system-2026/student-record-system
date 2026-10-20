'use strict';

/**
 * Shared helpers for integration tests: reset + seed the TEST database with the Test Plan
 * sample data (Test Plan 12.1), and log in as a given account via the real API.
 */
const request = require('supertest');
const { createApp } = require('../../src/app');
const { pool } = require('../../src/db/pool');
const { seed } = require('../../db/seed');

const app = createApp();

const ACCOUNTS = {
  admin: { username: 'admin01', password: 'Admin@123' },
  krao: { username: 'fac_krao', password: 'Faculty@123' },
  smenon: { username: 'fac_smenon', password: 'Faculty@123' },
  pnair: { username: 'stu_pnair', password: 'Student@123' },
};

/** Reset the test DB to the seeded state; a smaller generated dataset keeps tests fast. */
async function resetDatabase() {
  return seed(pool, { students: 30, faculty: 4, log: false });
}

/** Log in and return { agent, cookie, body }. The agent keeps the session cookie. */
async function login(who) {
  const creds = typeof who === 'string' ? ACCOUNTS[who] : who;
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(creds);
  if (res.status !== 200) throw new Error(`login failed for ${creds.username}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
  return { agent, cookie, body: res.body };
}

async function q(sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function courseId(code) {
  return (await q('SELECT id FROM courses WHERE code = $1', [code]))[0].id;
}
async function studentIdByRoll(roll) {
  return (await q('SELECT id FROM students WHERE roll_number = $1', [roll]))[0].id;
}
async function facultyIdByUsername(username) {
  return (await q('SELECT f.id FROM faculty f JOIN accounts a ON a.id = f.account_id WHERE a.username = $1', [username]))[0].id;
}
async function componentId(courseCode, name) {
  return (await q(
    `SELECT ac.id FROM assessment_components ac JOIN courses c ON c.id = ac.course_id
      WHERE c.code = $1 AND ac.name = $2`, [courseCode, name]
  ))[0].id;
}

/** Ids used repeatedly across the test cases. */
async function ids() {
  return {
    se: await courseId('UE24CS205'),
    cn: await courseId('UE24CS210'),
    dbms: await courseId('UE24CS220'),
    pnair: await studentIdByRoll('PES1UG24CS045'),
    krao: await facultyIdByUsername('fac_krao'),
    smenon: await facultyIdByUsername('fac_smenon'),
    ia1: await componentId('UE24CS205', 'Internal Assessment 1'),
  };
}

module.exports = { app, request, ACCOUNTS, resetDatabase, login, q, ids, courseId, studentIdByRoll };
