'use strict';

/**
 * TC-06 Marks Entry and Viewing - FR-9, FR-10 (GitHub #18, #19).
 */
const { resetDatabase, login, q, ids } = require('../helpers/testUtils');

let I;
let fac;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
  fac = await login('krao');
});

describe('TC-06 Marks Entry and Viewing', () => {
  test('prerequisite: UE24CS205 has "Internal Assessment 1" with maximum 20', async () => {
    const res = await fac.agent.get(`/api/courses/${I.se}/marks`);
    expect(res.status).toBe(200);
    expect(res.body.components.find((c) => c.id === I.ia1)).toMatchObject({ name: 'Internal Assessment 1', maxMarks: 20 });
  });

  test('steps 1-2: Faculty enters 17 for Priya Nair in Internal Assessment 1', async () => {
    const res = await fac.agent.post(`/api/courses/${I.se}/marks`)
      .send({ componentId: I.ia1, marks: [{ studentId: I.pnair, marksObtained: 17 }] });
    expect(res.status).toBe(201);
    const me = res.body.students.find((s) => s.studentId === I.pnair);
    expect(me.marks[I.ia1]).toBe(17);
  });

  test('entering marks again for the same student/component is a 409 (must use update)', async () => {
    const res = await fac.agent.post(`/api/courses/${I.se}/marks`)
      .send({ componentId: I.ia1, marks: [{ studentId: I.pnair, marksObtained: 15 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MARKS_EXIST');
  });

  test('step 3: Faculty edits the entry to 18', async () => {
    const res = await fac.agent.put(`/api/courses/${I.se}/marks/${I.ia1}`)
      .send({ marks: [{ studentId: I.pnair, marksObtained: 18 }] });
    expect(res.status).toBe(200);
    expect(res.body.students.find((s) => s.studentId === I.pnair).marks[I.ia1]).toBe(18);
  });

  test('boundary values: 0 and the maximum (20) are accepted; 20.5 and -1 are rejected', async () => {
    const put = (v) => fac.agent.put(`/api/courses/${I.se}/marks/${I.ia1}`).send({ marks: [{ studentId: I.pnair, marksObtained: v }] });
    expect((await put(0)).status).toBe(200);
    expect((await put(20)).status).toBe(200);
    const over = await put(20.5);
    expect(over.status).toBe(400);
    expect(over.body.error.message).toBe('Marks must be between 0 and 20 for Internal Assessment 1.');
    expect((await put(-1)).status).toBe(400);
    expect((await put('abc')).status).toBe(400);
    expect((await put(17.555)).status).toBe(400); // more than 2 decimals
    expect((await put(18)).status).toBe(200); // back to the TC value
    const [row] = await q(
      `SELECT m.marks_obtained FROM marks m JOIN enrollments e ON e.id = m.enrollment_id
        WHERE e.student_id = $1 AND m.component_id = $2`, [I.pnair, I.ia1]
    );
    expect(Number(row.marks_obtained)).toBe(18);
  });

  test('step 4: Faculty cannot open or submit marks for a course not assigned to them', async () => {
    expect((await fac.agent.get(`/api/courses/${I.cn}/marks`)).status).toBe(403);
    const cnIa1 = (await q(`SELECT id FROM assessment_components WHERE course_id = $1 ORDER BY position LIMIT 1`, [I.cn]))[0].id;
    const res = await fac.agent.post(`/api/courses/${I.cn}/marks`)
      .send({ componentId: cnIa1, marks: [{ studentId: I.pnair, marksObtained: 10 }] });
    expect(res.status).toBe(403);
    expect((await fac.agent.put(`/api/courses/${I.cn}/marks/${cnIa1}`).send({ marks: [{ studentId: I.pnair, marksObtained: 10 }] })).status).toBe(403);
  });

  test('a component id from another course is rejected (404)', async () => {
    const cnIa1 = (await q(`SELECT id FROM assessment_components WHERE course_id = $1 ORDER BY position LIMIT 1`, [I.cn]))[0].id;
    const res = await fac.agent.put(`/api/courses/${I.se}/marks/${cnIa1}`).send({ marks: [{ studentId: I.pnair, marksObtained: 10 }] });
    expect(res.status).toBe(404);
  });

  test('steps 5-6: Student sees Internal Assessment 1 = 18/20 for UE24CS205', async () => {
    const stu = await login('pnair');
    const res = await stu.agent.get(`/api/students/${I.pnair}/marks`).query({ courseId: I.se });
    expect(res.status).toBe(200);
    const course = res.body.courses[0];
    expect(course.code).toBe('UE24CS205');
    expect(course.components.find((c) => c.name === 'Internal Assessment 1'))
      .toMatchObject({ marksObtained: 18, maxMarks: 20 });
    expect(course.components.find((c) => c.name === 'Assignment').marksObtained).toBeNull();
  });

  test('step 7: Student cannot view another student\'s marks', async () => {
    const stu = await login('pnair');
    const other = (await q(`SELECT id FROM students WHERE id <> $1 LIMIT 1`, [I.pnair]))[0].id;
    const res = await stu.agent.get(`/api/students/${other}/marks`);
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('courses');
    expect((await stu.agent.get(`/api/courses/${I.se}/marks`)).status).toBe(403); // class marks sheet
  });

  test('Students cannot submit marks (SO-2)', async () => {
    const stu = await login('pnair');
    const res = await stu.agent.post(`/api/courses/${I.se}/marks`)
      .send({ componentId: I.ia1, marks: [{ studentId: I.pnair, marksObtained: 20 }] });
    expect(res.status).toBe(403);
  });
});
