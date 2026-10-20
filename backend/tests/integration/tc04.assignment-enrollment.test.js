'use strict';

/**
 * TC-04 Faculty-Course Assignment and Student Enrollment - FR-5, FR-6 (GitHub #14, #15).
 * The seed already has Dr. Kavita Rao -> UE24CS205 and Priya Nair -> UE24CS205, so the test
 * first removes them, then performs steps 2-8 exactly as written.
 */
const { resetDatabase, login, ids } = require('../helpers/testUtils');

let admin;
let I;
beforeAll(async () => {
  await resetDatabase();
  admin = await login('admin');
  I = await ids();
  await admin.agent.delete(`/api/courses/${I.se}/assignment`);
  await admin.agent.delete(`/api/courses/${I.se}/enrollments/${I.pnair}`);
});

describe('TC-04 Faculty-Course Assignment and Student Enrollment', () => {
  test('steps 2-3: assign Dr. Kavita Rao to UE24CS205; visible from course and faculty views', async () => {
    const res = await admin.agent.post(`/api/courses/${I.se}/assignment`).send({ facultyId: I.krao });
    expect(res.status).toBe(201);
    expect(res.body.assignment).toMatchObject({ courseId: I.se, facultyId: I.krao, facultyName: 'Dr. Kavita Rao' });

    const courseView = await admin.agent.get(`/api/courses/${I.se}/assignment`);
    expect(courseView.body.assignment.facultyName).toBe('Dr. Kavita Rao');
    const facultyView = await admin.agent.get(`/api/faculty/${I.krao}`);
    expect(facultyView.body.faculty.assignedCourses.map((c) => c.code)).toContain('UE24CS205');
  });

  test('a second POST assignment for the same course is a 409 (one faculty per course)', async () => {
    const res = await admin.agent.post(`/api/courses/${I.se}/assignment`).send({ facultyId: I.smenon });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_ASSIGNED');
  });

  test('steps 4-5: enroll Priya Nair in UE24CS205; visible from student and course views', async () => {
    const res = await admin.agent.post(`/api/courses/${I.se}/enrollments`).send({ studentId: I.pnair });
    expect(res.status).toBe(201);

    const courseView = await admin.agent.get(`/api/courses/${I.se}/enrollments`);
    expect(courseView.body.enrollments.map((e) => e.studentId)).toContain(I.pnair);
    const studentView = await admin.agent.get(`/api/students/${I.pnair}`);
    expect(studentView.body.student.enrollments.map((e) => e.code)).toContain('UE24CS205');
  });

  test('enrolling the same student twice is a 409 Conflict', async () => {
    const res = await admin.agent.post(`/api/courses/${I.se}/enrollments`).send({ studentId: I.pnair });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_ENROLLED');
  });

  test('step 6: reassign UE24CS205 to a different faculty member; the change is reflected', async () => {
    const res = await admin.agent.put(`/api/courses/${I.se}/assignment`).send({ facultyId: I.smenon });
    expect(res.status).toBe(200);
    expect(res.body.assignment.facultyName).toBe('Dr. Suresh Menon');
    const krao = await admin.agent.get(`/api/faculty/${I.krao}`);
    expect(krao.body.faculty.assignedCourses.map((c) => c.code)).not.toContain('UE24CS205');
  });

  test('step 7: remove Priya Nair\'s enrollment; the change is reflected', async () => {
    const res = await admin.agent.delete(`/api/courses/${I.se}/enrollments/${I.pnair}`);
    expect(res.status).toBe(200);
    const courseView = await admin.agent.get(`/api/courses/${I.se}/enrollments`);
    expect(courseView.body.enrollments.map((e) => e.studentId)).not.toContain(I.pnair);
    const again = await admin.agent.delete(`/api/courses/${I.se}/enrollments/${I.pnair}`);
    expect(again.status).toBe(404);
  });

  test('step 8: restore Dr. Kavita Rao -> UE24CS205 and Priya Nair -> UE24CS205', async () => {
    expect((await admin.agent.put(`/api/courses/${I.se}/assignment`).send({ facultyId: I.krao })).status).toBe(200);
    expect((await admin.agent.post(`/api/courses/${I.se}/enrollments`).send({ studentId: I.pnair })).status).toBe(201);
    const course = await admin.agent.get(`/api/courses/${I.se}`);
    expect(course.body.course.facultyName).toBe('Dr. Kavita Rao');
    const enr = await admin.agent.get(`/api/courses/${I.se}/enrollments`);
    expect(enr.body.enrollments.map((e) => e.studentId)).toContain(I.pnair);
  });

  test('validation and existence checks on association endpoints', async () => {
    expect((await admin.agent.post(`/api/courses/${I.se}/enrollments`).send({})).status).toBe(400);
    expect((await admin.agent.post(`/api/courses/${I.se}/enrollments`).send({ studentId: 999999 })).status).toBe(404);
    expect((await admin.agent.post('/api/courses/999999/assignment').send({ facultyId: I.krao })).status).toBe(404);
  });

  test('Faculty and Students cannot modify assignments or enrollments', async () => {
    const fac = await login('krao');
    expect((await fac.agent.post(`/api/courses/${I.cn}/assignment`).send({ facultyId: I.krao })).status).toBe(403);
    expect((await fac.agent.post(`/api/courses/${I.se}/enrollments`).send({ studentId: I.pnair })).status).toBe(403);
    const stu = await login('pnair');
    expect((await stu.agent.delete(`/api/courses/${I.se}/enrollments/${I.pnair}`)).status).toBe(403);
  });

  test('Faculty may view their own course\'s assignment/roster but not another course\'s', async () => {
    const fac = await login('krao');
    expect((await fac.agent.get(`/api/courses/${I.se}/enrollments`)).status).toBe(200);
    expect((await fac.agent.get(`/api/courses/${I.se}/assignment`)).status).toBe(200);
    expect((await fac.agent.get(`/api/courses/${I.cn}/enrollments`)).status).toBe(403);
    expect((await fac.agent.get(`/api/courses/${I.cn}/assignment`)).status).toBe(403);
  });
});
