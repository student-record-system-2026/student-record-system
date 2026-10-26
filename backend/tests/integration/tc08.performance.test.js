'use strict';

/**
 * TC-08 Performance - NFR-1 (GitHub #24), API layer.
 *
 * NFR-1: standard pages (dashboards, record lists) load within 3 seconds with a class-sized dataset.
 * This suite seeds the full TC-08 dataset (Test Plan 12.3: ~300 students, 20 faculty, 10 courses)
 * and times every API request behind the pages in TC-08 steps 1-5. It runs in CI on every PR as a
 * regression guard; the end-to-end page load times in a browser are measured by
 * e2e/performance.test.js (the TC-08 execution record).
 *
 * Budget: each request must answer within 1 second (one third of the 3-second page budget),
 * leaving the rest for the browser to download and render the page.
 */
const { seed } = require('../../db/seed');
const { pool } = require('../../src/db/pool');
const { login, q } = require('../helpers/testUtils');

const RUNS = 5;
const API_BUDGET_MS = 1000;
const timings = [];

async function time(agent, label, url) {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = process.hrtime.bigint();
    const res = await agent.get(url);
    runs.push(Number(process.hrtime.bigint() - t0) / 1e6);
    expect(res.status).toBe(200);
  }
  const max = Math.max(...runs);
  timings.push({ label, url, median: [...runs].sort((a, b) => a - b)[Math.floor(RUNS / 2)], max });
  return max;
}

beforeAll(async () => {
  await seed(pool, { students: 300, faculty: 20, log: false }); // full TC-08 dataset
}, 120000);

afterAll(() => {
  // Printed so the CI log shows the measured times.
  console.log(
    'TC-08 API timings (ms, ' + RUNS + ' runs each)\n' +
      timings.map((t) => `  ${t.label.padEnd(44)} median ${t.median.toFixed(1).padStart(7)}  max ${t.max.toFixed(1).padStart(7)}`).join('\n')
  );
});

describe('TC-08 Performance (NFR-1) with the class-sized dataset', () => {
  test('dataset matches the TC-08 test parameters', async () => {
    const [c] = await q(`SELECT (SELECT COUNT(*) FROM students)::int AS students,
                                (SELECT COUNT(*) FROM faculty)::int AS faculty,
                                (SELECT COUNT(*) FROM courses)::int AS courses`);
    expect(c.students).toBeGreaterThanOrEqual(300);
    expect(c.faculty).toBeGreaterThanOrEqual(20);
    expect(c.courses).toBe(10);
  });

  test('steps 1-3: Administrator dashboard and Student record list', async () => {
    const { agent } = await login('admin');
    expect(await time(agent, 'Admin dashboard', '/api/dashboard')).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Student record list', '/api/students')).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Student record list (search)', '/api/students?search=PES1UG24')).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Faculty record list', '/api/faculty')).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Course list', '/api/courses')).toBeLessThan(API_BUDGET_MS);
  });

  test('step 4: Faculty dashboard and attendance / marks entry screens', async () => {
    const { agent } = await login('krao');
    const dash = await agent.get('/api/dashboard');
    const courseId = dash.body.assignedCourses[0].id;
    expect(await time(agent, 'Faculty dashboard', '/api/dashboard')).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Attendance entry (course roster + sessions)', `/api/courses/${courseId}/attendance`)).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Marks entry (marks sheet)', `/api/courses/${courseId}/marks`)).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Faculty profile with class lists', '/api/profile')).toBeLessThan(API_BUDGET_MS);
  });

  test('step 5: Student dashboard and attendance / marks views', async () => {
    const { agent, body } = await login('pnair');
    const sid = body.user.studentId;
    expect(await time(agent, 'Student dashboard', '/api/dashboard')).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Student attendance view', `/api/students/${sid}/attendance`)).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Student marks view', `/api/students/${sid}/marks`)).toBeLessThan(API_BUDGET_MS);
    expect(await time(agent, 'Student profile', '/api/profile')).toBeLessThan(API_BUDGET_MS);
  });
});
