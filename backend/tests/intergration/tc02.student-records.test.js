'use strict';

/**
 * TC-02 Student Record Management - FR-2, NFR-4 (GitHub #11, #27).
 */
const { resetDatabase, login, q, ids } = require('../helpers/testUtils');

let admin;
let id;
beforeAll(async () => {
  await resetDatabase();
  admin = await login('admin');
});

const NEW_STUDENT = {
  name: 'Priya Nair',
  rollNumber: 'PES1UG24CS099',
  department: 'CSE',
  batch: '2024',
  email: 'priya.nair@example.com',
  password: 'Welcome@123',
};

describe('TC-02 Student Record Management', () => {
  test('steps 1-3: Administrator creates a student; it appears in the list', async () => {
    const res = await admin.agent.post('/api/students').send(NEW_STUDENT);
    expect(res.status).toBe(201);
    expect(res.body.student).toMatchObject({
      name: 'Priya Nair', rollNumber: 'PES1UG24CS099', department: 'CSE', batch: '2024',
      email: 'priya.nair@example.com', status: 'ACTIVE', username: 'pes1ug24cs099',
    });
    expect(res.body.student).not.toHaveProperty('password');
    id = res.body.student.id;

    const list = await admin.agent.get('/api/students').query({ search: 'PES1UG24CS099' });
    expect(list.status).toBe(200);
    expect(list.body.students.map((s) => s.id)).toContain(id);

    // NFR-2: the account stores only a bcrypt hash.
    const [acc] = await q('SELECT password_hash FROM accounts WHERE username = $1', ['pes1ug24cs099']);
    expect(acc.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(acc.password_hash).not.toContain('Welcome@123');
  });

  test('view: GET /api/students/:id returns the record with its enrollments', async () => {
    const res = await admin.agent.get(`/api/students/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.student.rollNumber).toBe('PES1UG24CS099');
    expect(res.body.student.enrollments).toEqual([]);
  });

  test('steps 4-5: Administrator updates the contact field; the new value is saved', async () => {
    const { password, ...rest } = NEW_STUDENT; // eslint-disable-line no-unused-vars
    const res = await admin.agent.put(`/api/students/${id}`).send({ ...rest, email: 'priya.n@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.student.email).toBe('priya.n@example.com');
    const again = await admin.agent.get(`/api/students/${id}`);
    expect(again.body.student.email).toBe('priya.n@example.com');
  });

  test('steps 6-7: deactivation retains the record as Inactive and excludes it from new enrollment', async () => {
    const res = await admin.agent.patch(`/api/students/${id}/deactivate`);
    expect(res.status).toBe(200);
    expect(res.body.student.status).toBe('INACTIVE');

    const still = await admin.agent.get(`/api/students/${id}`);
    expect(still.status).toBe(200);
    expect(still.body.student.status).toBe('INACTIVE');

    const { se } = await ids();
    const enroll = await admin.agent.post(`/api/courses/${se}/enrollments`).send({ studentId: id });
    expect(enroll.status).toBe(409);
    expect(enroll.body.error.code).toBe('STUDENT_INACTIVE');
  });

  test('step 8: Faculty is denied create, update and deactivate of student records', async () => {
    const fac = await login('krao');
    expect((await fac.agent.get('/api/students')).status).toBe(403);
    expect((await fac.agent.post('/api/students').send(NEW_STUDENT)).status).toBe(403);
    expect((await fac.agent.put(`/api/students/${id}`).send(NEW_STUDENT)).status).toBe(403);
    expect((await fac.agent.patch(`/api/students/${id}/deactivate`)).status).toBe(403);
    const [row] = await q('SELECT status FROM students WHERE id = $1', [id]);
    expect(row.status).toBe('INACTIVE'); // unchanged
  });

  test('step 9 (NFR-4): blank Roll No gives a clear validation error and creates nothing', async () => {
    const before = await q('SELECT COUNT(*)::int AS n FROM students');
    const res = await admin.agent.post('/api/students').send({ ...NEW_STUDENT, rollNumber: '', email: 'other@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Roll number is required.' });
    expect(res.body.error.details).toEqual([{ field: 'rollNumber', issue: 'missing', message: 'Roll number is required.' }]);
    const after = await q('SELECT COUNT(*)::int AS n FROM students');
    expect(after[0].n).toBe(before[0].n);
  });

  test('NFR-4: invalid formats are rejected field-by-field', async () => {
    const res = await admin.agent.post('/api/students').send({
      ...NEW_STUDENT, rollNumber: 'PES 1/@', email: 'not-an-email', batch: '24', password: 'short',
    });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['rollNumber', 'email', 'batch', 'password']));
  });

  test('duplicate roll number is a 409 Conflict and leaves data unchanged', async () => {
    const before = await q('SELECT COUNT(*)::int AS n FROM accounts');
    const res = await admin.agent.post('/api/students').send({ ...NEW_STUDENT, email: 'dup@example.com', username: 'dupuser' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ROLL_NUMBER');
    const after = await q('SELECT COUNT(*)::int AS n FROM accounts');
    expect(after[0].n).toBe(before[0].n); // no orphan account (transaction rolled back)
  });

  test('non-existent student id returns 404; non-numeric id returns 400', async () => {
    expect((await admin.agent.get('/api/students/999999')).status).toBe(404);
    expect((await admin.agent.get('/api/students/abc')).status).toBe(400);
  });

  test('Administrator can restore an inactive student via update (status field)', async () => {
    const { password, ...rest } = NEW_STUDENT; // eslint-disable-line no-unused-vars
    const res = await admin.agent.put(`/api/students/${id}`).send({ ...rest, email: 'priya.n@example.com', status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.student.status).toBe('ACTIVE');
  });
});
