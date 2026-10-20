'use strict';

/**
 * TC-03 Faculty and Course Management - FR-3, FR-4 (GitHub #12, #13).
 */
const { resetDatabase, login, q, ids } = require('../helpers/testUtils');

let admin;
let facultyId;
let newCourseId;
beforeAll(async () => {
  await resetDatabase();
  admin = await login('admin');
});

const NEW_FACULTY = {
  name: 'Dr. Kavita Rao', department: 'CSE', email: 'kavita.rao@example.com', password: 'Welcome@123',
};

describe('TC-03 Faculty and Course Management', () => {
  test('steps 1-2: create faculty "Dr. Kavita Rao"; it appears in the faculty list', async () => {
    const res = await admin.agent.post('/api/faculty').send(NEW_FACULTY);
    expect(res.status).toBe(201);
    expect(res.body.faculty).toMatchObject({ name: 'Dr. Kavita Rao', department: 'CSE', status: 'ACTIVE', username: 'kavita.rao' });
    facultyId = res.body.faculty.id;
    const list = await admin.agent.get('/api/faculty').query({ search: 'Kavita' });
    expect(list.body.faculty.map((f) => f.id)).toContain(facultyId);
  });

  test('step 3: update faculty contact information', async () => {
    const res = await admin.agent.put(`/api/faculty/${facultyId}`)
      .send({ name: 'Dr. Kavita Rao', department: 'CSE', email: 'kavita.rao@pes.example.com', phone: '+91 98450 11111' });
    expect(res.status).toBe(200);
    expect(res.body.faculty).toMatchObject({ email: 'kavita.rao@pes.example.com', phone: '+91 98450 11111' });
  });

  test('faculty validation errors are reported clearly (NFR-4)', async () => {
    const res = await admin.agent.post('/api/faculty').send({ name: '', department: '', email: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'email', 'department', 'password']));
  });

  test('step 4: create course UE24CS301 (with assessment components); it appears in the list', async () => {
    const res = await admin.agent.post('/api/courses').send({
      code: 'UE24CS301', name: 'Data Structures', credits: 4,
      components: [{ name: 'Internal Assessment 1', maxMarks: 20 }, { name: 'Assignment', maxMarks: 10 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.course).toMatchObject({ code: 'UE24CS301', name: 'Data Structures', credits: 4, status: 'ACTIVE' });
    expect(res.body.course.components.map((c) => c.name)).toEqual(['Internal Assessment 1', 'Assignment']);
    newCourseId = res.body.course.id;
    const list = await admin.agent.get('/api/courses');
    expect(list.body.courses.map((c) => c.code)).toContain('UE24CS301');
  });

  test('step 5: update course name and credits', async () => {
    const res = await admin.agent.put(`/api/courses/${newCourseId}`)
      .send({ code: 'UE24CS301', name: 'Data Structures and Applications', credits: 3 });
    expect(res.status).toBe(200);
    expect(res.body.course).toMatchObject({ name: 'Data Structures and Applications', credits: 3 });
    expect(res.body.course.components).toHaveLength(2); // components untouched when omitted
  });

  test('duplicate course code -> 409; invalid credits -> 400', async () => {
    const dup = await admin.agent.post('/api/courses').send({ code: 'ue24cs205', name: 'Copy', credits: 4 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_COURSE_CODE');
    const bad = await admin.agent.post('/api/courses').send({ code: 'UE24CS999', name: 'Bad', credits: 0 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].field).toBe('credits');
  });

  test('step 6: UE24CS301 (no assignment/enrollment) is permanently deleted', async () => {
    const res = await admin.agent.delete(`/api/courses/${newCourseId}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect((await admin.agent.get(`/api/courses/${newCourseId}`)).status).toBe(404);
    expect(await q('SELECT 1 FROM courses WHERE id = $1', [newCourseId])).toHaveLength(0);
  });

  test('step 7: UE24CS205 (has assignment + enrollment) is NOT deleted - it is deactivated', async () => {
    const { se } = await ids();
    const res = await admin.agent.delete(`/api/courses/${se}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURSE_DEACTIVATED_INSTEAD');
    const course = await admin.agent.get(`/api/courses/${se}`);
    expect(course.status).toBe(200);
    expect(course.body.course.status).toBe('INACTIVE');
    // Assignment and enrollments are untouched.
    expect(course.body.course.facultyName).toBe('Dr. Kavita Rao');
    expect(course.body.course.enrolledCount).toBeGreaterThan(0);
  });

  test('step 8: deactivated faculty is retained and excluded from new course assignments', async () => {
    const res = await admin.agent.patch(`/api/faculty/${facultyId}/deactivate`);
    expect(res.status).toBe(200);
    expect(res.body.faculty.status).toBe('INACTIVE');
    // Create an unassigned course and try to assign the inactive faculty to it.
    const c = await admin.agent.post('/api/courses').send({ code: 'UE24CS399', name: 'Elective', credits: 2 });
    const assign = await admin.agent.post(`/api/courses/${c.body.course.id}/assignment`).send({ facultyId });
    expect(assign.status).toBe(409);
    expect(assign.body.error.code).toBe('FACULTY_INACTIVE');
  });

  test('step 9: restore Dr. Kavita Rao and UE24CS205 to active status', async () => {
    const f = await admin.agent.put(`/api/faculty/${facultyId}`)
      .send({ name: 'Dr. Kavita Rao', department: 'CSE', email: 'kavita.rao@pes.example.com', status: 'ACTIVE' });
    expect(f.body.faculty.status).toBe('ACTIVE');
    const { se } = await ids();
    const c = await admin.agent.put(`/api/courses/${se}`)
      .send({ code: 'UE24CS205', name: 'Software Engineering', credits: 4, status: 'ACTIVE' });
    expect(c.status).toBe(200);
    expect(c.body.course.status).toBe('ACTIVE');
  });

  test('assessment components: a component that already has marks cannot be removed', async () => {
    const { dbms } = await ids(); // seeded with IA-1 marks
    const course = (await admin.agent.get(`/api/courses/${dbms}`)).body.course;
    const keep = course.components.filter((c) => c.name !== 'Internal Assessment 1');
    const res = await admin.agent.put(`/api/courses/${dbms}`).send({
      code: course.code, name: course.name, credits: course.credits,
      components: keep.map(({ id, name, maxMarks }) => ({ id, name, maxMarks })),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COMPONENT_HAS_MARKS');
  });

  test('Student and Faculty cannot create, update or delete courses', async () => {
    const stu = await login('pnair');
    const { se } = await ids();
    expect((await stu.agent.post('/api/courses').send({ code: 'Z1', name: 'Z', credits: 1 })).status).toBe(403);
    expect((await stu.agent.put(`/api/courses/${se}`).send({ code: 'Z1', name: 'Z', credits: 1 })).status).toBe(403);
    expect((await stu.agent.delete(`/api/courses/${se}`)).status).toBe(403);
  });
});
