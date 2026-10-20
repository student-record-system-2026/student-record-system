'use strict';

/**
 * TC-01 Authentication and Role-Based Access Control - FR-1, SO-3, NFR-2 (GitHub #10, #25).
 */
const { app, request, resetDatabase, login } = require('../helpers/testUtils');

beforeAll(resetDatabase);

describe('TC-01 Authentication and Role-Based Access Control', () => {
  test.each([
    ['admin01', 'Admin@123', 'ADMIN', '/admin'],
    ['fac_krao', 'Faculty@123', 'FACULTY', '/faculty'],
    ['stu_pnair', 'Student@123', 'STUDENT', '/student'],
  ])('steps 2/4/6: %s logs in and is redirected to the %s dashboard', async (username, password, role, path) => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(200);
    expect(res.body.redirectTo).toBe(path);
    expect(res.body.user.role).toBe(role);
    expect(res.headers['set-cookie'][0]).toMatch(/srs\.sid=.*HttpOnly/i);
    // NFR-2: no password or hash ever leaves the server.
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|\$2[aby]\$/i);

    const dash = await agent.get('/api/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.body.role).toBe(role);

    const out = await agent.post('/api/auth/logout'); // steps 3/5
    expect(out.status).toBe(200);
  });

  test('login also accepts the account email instead of the username (FR-1 "username/email")', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'pnair@student.srs.example.edu', password: 'Student@123' });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('stu_pnair');
  });

  test('step 7: an authenticated Student is denied the Administrator-only Manage Students operations', async () => {
    const { agent } = await login('pnair');
    const list = await agent.get('/api/students');
    expect(list.status).toBe(403);
    expect(list.body.error.code).toBe('FORBIDDEN');
    const create = await agent.post('/api/students').send({ name: 'X' });
    expect(create.status).toBe(403);
  });

  test('step 8: wrong password is rejected with a clear message and no session is created', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'stu_pnair', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('unknown username gets the same generic message (no account enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'Whatever1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid username or password.');
  });

  test('empty login fields return a 400 validation error (NFR-4)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(['username', 'password']);
  });

  test('Faculty cannot reach Administrator endpoints; Administrator cannot use Faculty-only writes', async () => {
    const fac = await login('krao');
    expect((await fac.agent.get('/api/faculty')).status).toBe(403);
    expect((await fac.agent.post('/api/courses').send({ code: 'X1', name: 'X', credits: 3 })).status).toBe(403);

    const admin = await login('admin');
    const res = await admin.agent.post('/api/courses/1/attendance').send({ sessionDate: '2026-09-01', records: [] });
    expect(res.status).toBe(403);
  });
});
