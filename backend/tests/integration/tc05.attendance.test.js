'use strict';

/**
 * TC-05 Attendance Recording and Viewing - FR-7, FR-8 (GitHub #16, #17).
 */
const { resetDatabase, login, q, ids } = require('../helpers/testUtils');

let I;
let fac;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
  fac = await login('krao');
});

const DATE = '2026-09-10';

async function rosterRecords(courseId, overrides) {
  const roster = (await fac.agent.get(`/api/courses/${courseId}/enrollments`)).body.enrollments;
  return roster.map((r) => ({ studentId: r.studentId, status: overrides[r.studentId] || 'PRESENT' }));
}

describe('TC-05 Attendance Recording and Viewing', () => {
  test('steps 1-2: Faculty records session 2026-09-10 for UE24CS205 with Priya Nair Present', async () => {
    const records = await rosterRecords(I.se, { [I.pnair]: 'PRESENT' });
    const res = await fac.agent.post(`/api/courses/${I.se}/attendance`).send({ sessionDate: DATE, records });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Attendance saved.');
    const session = res.body.sessions.find((s) => s.sessionDate === DATE);
    expect(session.records.find((r) => r.studentId === I.pnair).status).toBe('PRESENT');
  });

  test('recording the same session twice is a 409 (must use update)', async () => {
    const res = await fac.agent.post(`/api/courses/${I.se}/attendance`)
      .send({ sessionDate: DATE, records: [{ studentId: I.pnair, status: 'ABSENT' }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SESSION_EXISTS');
  });

  test('step 3: Faculty reopens the session and changes Priya Nair to Absent', async () => {
    const res = await fac.agent.put(`/api/courses/${I.se}/attendance/${DATE}`)
      .send({ records: [{ studentId: I.pnair, status: 'ABSENT' }] });
    expect(res.status).toBe(200);
    const [row] = await q(
      `SELECT a.status FROM attendance a JOIN enrollments e ON e.id = a.enrollment_id
        WHERE e.student_id = $1 AND e.course_id = $2 AND a.session_date = $3`, [I.pnair, I.se, DATE]
    );
    expect(row.status).toBe('ABSENT');
  });

  test('step 4: Faculty cannot record or view attendance for UE24CS210 (not assigned)', async () => {
    const post = await fac.agent.post(`/api/courses/${I.cn}/attendance`)
      .send({ sessionDate: DATE, records: [{ studentId: I.pnair, status: 'PRESENT' }] });
    expect(post.status).toBe(403);
    expect(post.body.error.message).toBe('You are not authorized for this course.');
    expect((await fac.agent.get(`/api/courses/${I.cn}/attendance`)).status).toBe(403);
    const put = await fac.agent.put(`/api/courses/${I.cn}/attendance/2026-09-03`)
      .send({ records: [{ studentId: I.pnair, status: 'PRESENT' }] });
    expect(put.status).toBe(403);
  });

  test('steps 5-6: Student sees session-wise records and a percentage matching what was recorded', async () => {
    const stu = await login('pnair');
    const res = await stu.agent.get(`/api/students/${I.pnair}/attendance`).query({ courseId: I.se });
    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
    const c = res.body.courses[0];
    expect(c.code).toBe('UE24CS205');
    expect(c.sessions.find((s) => s.sessionDate === DATE).status).toBe('ABSENT');

    const [db] = await q(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE a.status = 'PRESENT')::int AS present
         FROM attendance a JOIN enrollments e ON e.id = a.enrollment_id
        WHERE e.student_id = $1 AND e.course_id = $2`, [I.pnair, I.se]
    );
    expect(c.total).toBe(db.total);
    expect(c.present).toBe(db.present);
    expect(c.percentage).toBeCloseTo(Math.round((db.present / db.total) * 1000) / 10, 5);

    // Without courseId: only enrolled courses, never UE24CS210.
    const all = await stu.agent.get(`/api/students/${I.pnair}/attendance`);
    expect(all.body.courses.map((x) => x.code).sort()).toEqual(['UE24CS205', 'UE24CS220', 'UE24CS230']);
  });

  test('step 7: Student is denied attendance for a course they are not enrolled in', async () => {
    const stu = await login('pnair');
    const res = await stu.agent.get(`/api/students/${I.pnair}/attendance`).query({ courseId: I.cn });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('You are not enrolled in this course.');
    expect((await stu.agent.get(`/api/courses/${I.cn}/attendance`)).status).toBe(403);
  });

  test('Administrator can view (but not record) course attendance', async () => {
    const admin = await login('admin');
    const res = await admin.agent.get(`/api/courses/${I.se}/attendance`).query({ date: DATE });
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
  });

  test('NFR-4: invalid attendance input is rejected without changing stored data', async () => {
    const before = await q('SELECT COUNT(*)::int AS n FROM attendance');
    const cases = [
      { sessionDate: '2026-02-30', records: [{ studentId: I.pnair, status: 'PRESENT' }] }, // impossible date
      { sessionDate: '2999-01-01', records: [{ studentId: I.pnair, status: 'PRESENT' }] }, // future date
      { sessionDate: '2026-09-11', records: [] }, // no records
      { sessionDate: '2026-09-11', records: [{ studentId: I.pnair, status: 'LATE' }] }, // bad status
      { sessionDate: '2026-09-11', records: [{ studentId: I.pnair, status: 'PRESENT' }, { studentId: I.pnair, status: 'ABSENT' }] },
      { records: [{ studentId: I.pnair, status: 'PRESENT' }] }, // missing date
    ];
    for (const body of cases) {
      const res = await fac.agent.post(`/api/courses/${I.se}/attendance`).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    // Student not enrolled in the course (from UE24CS210 roster).
    const cnRoster = await q(`SELECT student_id FROM enrollments WHERE course_id = $1
                               AND student_id NOT IN (SELECT student_id FROM enrollments WHERE course_id = $2)`, [I.cn, I.se]);
    const outsider = cnRoster[0].student_id;
    const res = await fac.agent.post(`/api/courses/${I.se}/attendance`)
      .send({ sessionDate: '2026-09-11', records: [{ studentId: I.pnair, status: 'PRESENT' }, { studentId: outsider, status: 'PRESENT' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].issue).toBe('not_enrolled');

    const after = await q('SELECT COUNT(*)::int AS n FROM attendance');
    expect(after[0].n).toBe(before[0].n); // nothing partially written
  });

  test('updating a session that was never recorded returns 404', async () => {
    const res = await fac.agent.put(`/api/courses/${I.se}/attendance/2026-07-01`)
      .send({ records: [{ studentId: I.pnair, status: 'PRESENT' }] });
    expect(res.status).toBe(404);
  });
});
