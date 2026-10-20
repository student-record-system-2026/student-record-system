'use strict';

/**
 * TC-07 Profiles, Dashboards and Logout - FR-11, FR-12, FR-13, FR-14 (GitHub #20, #21, #22, #31).
 */
const { resetDatabase, login, ids } = require('../helpers/testUtils');

let I;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
});

describe('TC-07 Profiles, Dashboards and Logout', () => {
  test('steps 1-3: Student dashboard, profile and logout', async () => {
    const { agent } = await login('pnair');
    const dash = await agent.get('/api/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.body.role).toBe('STUDENT');
    const codes = dash.body.enrolledCourses.map((c) => c.code).sort();
    expect(codes).toEqual(['UE24CS205', 'UE24CS220', 'UE24CS230']);
    const se = dash.body.enrolledCourses.find((c) => c.code === 'UE24CS205');
    expect(se.attendance).toEqual(expect.objectContaining({ present: expect.any(Number), total: expect.any(Number) }));
    expect(se.marks).toEqual(expect.objectContaining({ componentCount: 3 }));
    expect(dash.body.links.map((l) => l.path)).toEqual(
      expect.arrayContaining(['/student/profile', '/student/attendance', '/student/marks'])
    );

    const profile = await agent.get('/api/profile');
    expect(profile.status).toBe(200);
    expect(profile.body.profile).toMatchObject({ name: 'Priya Nair', rollNumber: 'PES1UG24CS045', department: 'CSE', batch: '2024' });
    expect(profile.body.profile).not.toHaveProperty('accountId');
    expect(profile.body.enrolledCourses.map((c) => c.code).sort()).toEqual(['UE24CS205', 'UE24CS220', 'UE24CS230']);

    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/dashboard')).status).toBe(401);
  });

  test('steps 4-6: Faculty dashboard (assigned courses + enrolled counts), profile with rosters, logout', async () => {
    const { agent } = await login('krao');
    const dash = await agent.get('/api/dashboard');
    expect(dash.body.role).toBe('FACULTY');
    const se = dash.body.assignedCourses.find((c) => c.code === 'UE24CS205');
    expect(se.enrolledCount).toBeGreaterThan(0);
    expect(se.links.map((l) => l.path)).toEqual([`/faculty/courses/${I.se}/attendance`, `/faculty/courses/${I.se}/marks`]);
    expect(dash.body.assignedCourses.map((c) => c.code)).not.toContain('UE24CS210');

    const profile = await agent.get('/api/profile');
    expect(profile.body.profile).toMatchObject({ name: 'Dr. Kavita Rao', department: 'CSE' });
    const seProfile = profile.body.assignedCourses.find((c) => c.code === 'UE24CS205');
    expect(seProfile.students.map((s) => s.studentId)).toContain(I.pnair);
    expect(seProfile.students).toHaveLength(se.enrolledCount);

    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/profile')).status).toBe(401);
  });

  test('steps 7-8: Administrator dashboard (record counts + quick links) and logout', async () => {
    const { agent } = await login('admin');
    const dash = await agent.get('/api/dashboard');
    expect(dash.body.role).toBe('ADMIN');
    expect(dash.body.counts.students.total).toBe(30);
    expect(dash.body.counts.faculty.total).toBe(4);
    expect(dash.body.counts.courses.total).toBe(10);
    expect(dash.body.links.map((l) => l.path)).toEqual(
      expect.arrayContaining(['/admin/students', '/admin/faculty', '/admin/courses'])
    );
    // GET /api/profile is defined for Faculty and Student only (SADS 4.3.8).
    expect((await agent.get('/api/profile')).status).toBe(403);
    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/dashboard')).status).toBe(401);
  });

  test('course listing is scoped by role (SO-1)', async () => {
    const stu = await login('pnair');
    const codes = (await stu.agent.get('/api/courses')).body.courses.map((c) => c.code).sort();
    expect(codes).toEqual(['UE24CS205', 'UE24CS220', 'UE24CS230']);
    expect((await stu.agent.get(`/api/courses/${I.cn}`)).status).toBe(403);

    const fac = await login('krao');
    const fcodes = (await fac.agent.get('/api/courses')).body.courses.map((c) => c.code).sort();
    expect(fcodes).toEqual(['UE24CS205', 'UE24CS220']);
  });
});
