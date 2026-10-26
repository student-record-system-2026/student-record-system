'use strict';

/**
 * FR-14 User Logout and Session Termination (GitHub #23), verified at the session-store level.
 * Complements TC-07 (logout per role) and TC-10 steps 5-6 (replayed cookie rejected).
 *
 * FR-14: "The system shall allow a logged-in user to log out of the system, terminating their
 * active session."  NFR-8: a terminated session cannot be used again.
 */
const { app, request, resetDatabase, login, q } = require('../helpers/testUtils');

const sessionRows = async () => (await q('SELECT COUNT(*)::int AS n FROM user_sessions'))[0].n;

beforeAll(async () => {
  await resetDatabase();
});

describe('FR-14 Logout - session lifecycle', () => {
  test.each([
    ['Administrator', 'admin'],
    ['Faculty', 'krao'],
    ['Student', 'pnair'],
  ])('%s: logout deletes the server-side session row and clears the cookie', async (_role, who) => {
    const before = await sessionRows();
    const user = await login(who);
    expect(await sessionRows()).toBe(before + 1);

    const out = await user.agent.post('/api/auth/logout');
    expect(out.status).toBe(200);
    expect(out.body.message).toBe('You have been logged out.');

    // The session row is gone from the PostgreSQL store (not just hidden by the client).
    expect(await sessionRows()).toBe(before);
    // The response tells the browser to drop the cookie (expired Set-Cookie for srs.sid).
    const cleared = (out.headers['set-cookie'] || []).find((c) => c.startsWith('srs.sid='));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);

    expect((await user.agent.get('/api/dashboard')).status).toBe(401);
  });

  test('logout terminates only the session that logged out; the same user on another device stays logged in', async () => {
    const laptop = await login('krao');
    const phone = await login('krao');
    expect(laptop.cookie).not.toBe(phone.cookie);

    expect((await laptop.agent.post('/api/auth/logout')).status).toBe(200);
    expect((await laptop.agent.get('/api/dashboard')).status).toBe(401);
    expect((await phone.agent.get('/api/dashboard')).status).toBe(200);

    expect((await phone.agent.post('/api/auth/logout')).status).toBe(200);
  });

  test('logging in again after logout issues a brand-new session id (the old one is never revived)', async () => {
    const first = await login('pnair');
    await first.agent.post('/api/auth/logout');
    const second = await login('pnair');
    expect(second.cookie).not.toBe(first.cookie);
    expect((await request(app).get('/api/auth/session').set('Cookie', first.cookie)).status).toBe(401);
    expect((await request(app).get('/api/auth/session').set('Cookie', second.cookie)).status).toBe(200);
    await second.agent.post('/api/auth/logout');
  });

  test('a session that has expired in the store is treated as terminated (401), like a logged-out one', async () => {
    const user = await login('admin');
    expect((await user.agent.get('/api/dashboard')).status).toBe(200);
    await q(`UPDATE user_sessions SET expire = NOW() - INTERVAL '1 minute'`);
    const res = await user.agent.get('/api/dashboard');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBeDefined();
  });

  test('logout without a session is rejected (401) and does not affect other users', async () => {
    const other = await login('admin');
    const before = await sessionRows();
    expect((await request(app).post('/api/auth/logout')).status).toBe(401);
    expect(await sessionRows()).toBe(before);
    expect((await other.agent.get('/api/dashboard')).status).toBe(200);
    await other.agent.post('/api/auth/logout');
  });
});
