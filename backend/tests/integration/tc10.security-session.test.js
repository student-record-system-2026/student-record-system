'use strict';

/**
 * TC-10 Security, Authorization and Session Protection - NFR-2, NFR-7, NFR-8, SO-1, SO-2, SO-3
 * (GitHub #25, #30, #31).
 */
const { app, request, resetDatabase, login, q, ids } = require('../helpers/testUtils');

let I;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
});

describe('TC-10 Security, Authorization and Session Protection', () => {
  test('step 1 (NFR-2): every stored credential is a bcrypt hash; no plain-text passwords', async () => {
    const rows = await q('SELECT username, password_hash FROM accounts');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.password_hash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
      expect(['Admin@123', 'Faculty@123', 'Student@123']).not.toContain(r.password_hash);
    }
    const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`);
    expect(cols.map((c) => c.column_name)).not.toContain('password');
  });

  test('NFR-2: no API response ever contains a password or hash', async () => {
    const admin = await login('admin');
    const bodies = [
      (await admin.agent.get('/api/students')).body,
      (await admin.agent.get(`/api/students/${I.pnair}`)).body,
      (await admin.agent.get('/api/faculty')).body,
      (await admin.agent.get(`/api/faculty/${I.krao}`)).body,
    ];
    for (const b of bodies) expect(JSON.stringify(b)).not.toMatch(/password|\$2[aby]\$/i);
  });

  test('step 2 (SO-2/SO-3/NFR-7): Student invoking an Administrator-only operation directly is rejected and nothing changes', async () => {
    const stu = await login('pnair');
    const victim = (await q('SELECT id FROM students WHERE id <> $1 LIMIT 1', [I.pnair]))[0].id;
    const res = await stu.agent.patch(`/api/students/${victim}/deactivate`);
    expect(res.status).toBe(403);
    const [row] = await q('SELECT status FROM students WHERE id = $1', [victim]);
    expect(row.status).toBe('ACTIVE');
    expect((await stu.agent.patch(`/api/students/${I.pnair}/deactivate`)).status).toBe(403); // not even self
    expect((await stu.agent.post(`/api/courses/${I.cn}/enrollments`).send({ studentId: I.pnair })).status).toBe(403);
  });

  test('step 3 (SRS 5.5/NFR-7): Faculty writing attendance or marks for an unassigned course is rejected', async () => {
    const fac = await login('krao');
    const before = await q('SELECT (SELECT COUNT(*) FROM attendance)::int AS a, (SELECT COUNT(*) FROM marks)::int AS m');
    const cnStudent = (await q(`SELECT student_id FROM enrollments WHERE course_id = $1 LIMIT 1`, [I.cn]))[0].student_id;
    const cnComp = (await q(`SELECT id FROM assessment_components WHERE course_id = $1 LIMIT 1`, [I.cn]))[0].id;
    expect((await fac.agent.post(`/api/courses/${I.cn}/attendance`)
      .send({ sessionDate: '2026-09-15', records: [{ studentId: cnStudent, status: 'ABSENT' }] })).status).toBe(403);
    expect((await fac.agent.put(`/api/courses/${I.cn}/marks/${cnComp}`)
      .send({ marks: [{ studentId: cnStudent, marksObtained: 0 }] })).status).toBe(403);
    const after = await q('SELECT (SELECT COUNT(*) FROM attendance)::int AS a, (SELECT COUNT(*) FROM marks)::int AS m');
    expect(after).toEqual(before);
  });

  test('step 4 (SO-1): Student altering the id in the request cannot read another student\'s data', async () => {
    const stu = await login('pnair');
    const other = (await q('SELECT id FROM students WHERE id <> $1 LIMIT 1', [I.pnair]))[0].id;
    for (const path of [`/api/students/${other}/marks`, `/api/students/${other}/attendance`, `/api/students/${other}`]) {
      const res = await stu.agent.get(path);
      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body).not.toHaveProperty('courses');
    }
  });

  test('steps 5-6 (NFR-8): after logout, replaying the old session cookie is rejected for every protected endpoint', async () => {
    const { agent, cookie } = await login('pnair');
    expect((await agent.get('/api/dashboard')).status).toBe(200);
    const sid = decodeURIComponent(cookie.split('=')[1]).replace(/^s:/, '').split('.')[0];
    expect(await q('SELECT 1 FROM user_sessions WHERE sid = $1', [sid])).toHaveLength(1);

    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(200);
    expect(out.headers['set-cookie'].join(';')).toMatch(/srs\.sid=;/);
    expect(await q('SELECT 1 FROM user_sessions WHERE sid = $1', [sid])).toHaveLength(0); // destroyed server-side

    for (const path of ['/api/dashboard', '/api/profile', `/api/students/${I.pnair}/marks`,
      `/api/students/${I.pnair}/attendance`, '/api/courses', '/api/auth/session']) {
      const res = await request(app).get(path).set('Cookie', cookie);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(401);
  });

  test('NFR-8: API responses are marked no-store so Back navigation cannot show cached data', async () => {
    const { agent } = await login('pnair');
    const res = await agent.get('/api/dashboard');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('a fresh session id is issued at every login (session fixation)', async () => {
    const a = await login('pnair');
    const b = await login('pnair');
    expect(a.cookie).not.toBe(b.cookie);
  });

  test('requests without any session are 401 for every protected endpoint', async () => {
    for (const path of ['/api/students', '/api/faculty', '/api/courses', `/api/courses/${I.se}/attendance`,
      `/api/courses/${I.se}/marks`, '/api/profile', '/api/dashboard']) {
      expect((await request(app).get(path)).status).toBe(401);
    }
  });

  test('a forged / tampered session cookie is rejected', async () => {
    const res = await request(app).get('/api/dashboard').set('Cookie', 'srs.sid=s%3Aforged.invalidsignature');
    expect(res.status).toBe(401);
  });

  test('error responses do not leak internals (no stack traces or SQL)', async () => {
    const admin = await login('admin');
    const res = await admin.agent.post('/api/students').set('Content-Type', 'application/json').send('{"broken json');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|SELECT|INSERT|stack/i);
  });
});
