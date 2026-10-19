'use strict';

/**
 * Seed data (Test Plan 5.2 / 12.1).
 *
 * Named records exactly as the Test Plan test cases expect them:
 *   admin01   / Admin@123    Administrator
 *   fac_krao  / Faculty@123  Dr. Kavita Rao  - assigned UE24CS205 (+ UE24CS220), NOT UE24CS210
 *   fac_smenon/ Faculty@123  Dr. Suresh Menon - assigned UE24CS210
 *   stu_pnair / Student@123  Priya Nair (PES1UG24CS045) - enrolled UE24CS205, UE24CS220, UE24CS230,
 *                            NOT enrolled in UE24CS210
 *   UE24CS205 Software Engineering - has an assignment and enrollments (TC-03 step 7),
 *             components "Internal Assessment 1" (max 20), "Internal Assessment 2" (20), "Assignment" (10),
 *             NO attendance session on 2026-09-10 and NO IA-1 marks yet (TC-05 / TC-06 enter them).
 *   UE24CS301 and roll number PES1UG24CS099 are deliberately NOT seeded (TC-03 / TC-02 create them).
 *
 * Plus generated class-sized data (default: 300 students, 20 faculty, 10 courses - TC-08 dataset).
 * All generated accounts share the passwords above. Passwords are stored only as bcrypt hashes.
 */
const bcrypt = require('bcryptjs');

const PASSWORDS = { ADMIN: 'Admin@123', FACULTY: 'Faculty@123', STUDENT: 'Student@123' };

const COURSES = [
  ['UE24CS205', 'Software Engineering', 4],
  ['UE24CS210', 'Computer Networks', 4],
  ['UE24CS220', 'Database Management Systems', 4],
  ['UE24CS230', 'Operating Systems', 4],
  ['UE24CS240', 'Design and Analysis of Algorithms', 4],
  ['UE24MA241', 'Linear Algebra', 3],
  ['UE24CS250', 'Theory of Computation', 3],
  ['UE24CS260', 'Machine Learning', 4],
  ['UE24CS270', 'Computer Graphics', 3],
  ['UE24CS280', 'Web Technologies', 3],
];
const COMPONENTS = [
  ['Internal Assessment 1', 20],
  ['Internal Assessment 2', 20],
  ['Assignment', 10],
];
const SESSION_DATES = ['2026-08-17', '2026-08-20', '2026-08-24', '2026-08-27', '2026-08-31', '2026-09-03'];

const FIRST = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Karthik', 'Sneha', 'Vikram', 'Meera', 'Arjun', 'Kavya',
  'Rahul', 'Ishita', 'Siddharth', 'Pooja', 'Nikhil', 'Divya', 'Aditya', 'Lakshmi', 'Varun', 'Nandini',
  'Harsha', 'Shreya', 'Manoj', 'Tanvi', 'Pranav', 'Riya', 'Suhas', 'Anjali', 'Gautam', 'Bhavana'];
const LAST = ['Sharma', 'Iyer', 'Reddy', 'Patel', 'Kulkarni', 'Rao', 'Hegde', 'Gupta', 'Shetty', 'Joshi',
  'Menon', 'Bhat', 'Kumar', 'Naidu', 'Desai', 'Pillai', 'Shenoy', 'Verma', 'Murthy', 'Kamath'];
const DEPARTMENTS = ['CSE', 'CSE', 'CSE', 'ECE', 'AIML'];

/** Small deterministic PRNG so the seeded dataset is identical on every run. */
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

async function insertAccounts(client, rows) {
  // rows: [{ username, email, hash, role }]
  const { rows: out } = await client.query(
    `INSERT INTO accounts (username, email, password_hash, role)
     SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[])
     RETURNING id`,
    [rows.map((r) => r.username), rows.map((r) => r.email), rows.map((r) => r.hash), rows.map((r) => r.role)]
  );
  return out.map((r) => r.id);
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ students?: number, faculty?: number, log?: boolean }} opts
 */
async function seed(db, { students: studentCount = 300, faculty: facultyCount = 20, log = true } = {}) {
  const rand = prng(20260916);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const client = db.connect ? await db.connect() : db;
  const release = db.connect ? () => client.release() : () => {};

  try {
    await client.query('BEGIN');
    await client.query(
      `TRUNCATE marks, attendance, enrollments, course_assignments, assessment_components,
                courses, faculty, students, accounts, user_sessions RESTART IDENTITY CASCADE`
    );

    const hash = {
      ADMIN: bcrypt.hashSync(PASSWORDS.ADMIN, 10),
      FACULTY: bcrypt.hashSync(PASSWORDS.FACULTY, 10),
      STUDENT: bcrypt.hashSync(PASSWORDS.STUDENT, 10),
    };

    // ---- Administrator -----------------------------------------------------
    await insertAccounts(client, [{ username: 'admin01', email: 'admin01@srs.example.edu', hash: hash.ADMIN, role: 'ADMIN' }]);

    // ---- Faculty -----------------------------------------------------------
    const facultyRows = [
      { username: 'fac_krao', name: 'Dr. Kavita Rao', email: 'krao@faculty.srs.example.edu', department: 'CSE', designation: 'Associate Professor' },
      { username: 'fac_smenon', name: 'Dr. Suresh Menon', email: 'smenon@faculty.srs.example.edu', department: 'CSE', designation: 'Professor' },
    ];
    for (let i = facultyRows.length; i < Math.max(facultyCount, 2); i++) {
      const name = `Dr. ${FIRST[(i * 7) % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
      facultyRows.push({
        username: `fac${String(i + 1).padStart(3, '0')}`,
        name,
        email: `fac${String(i + 1).padStart(3, '0')}@faculty.srs.example.edu`,
        department: DEPARTMENTS[i % DEPARTMENTS.length],
        designation: i % 3 === 0 ? 'Professor' : 'Assistant Professor',
      });
    }
    const facAccountIds = await insertAccounts(
      client, facultyRows.map((f) => ({ username: f.username, email: f.email, hash: hash.FACULTY, role: 'FACULTY' }))
    );
    const { rows: facIdRows } = await client.query(
      `INSERT INTO faculty (account_id, name, email, department, designation, phone)
       SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) RETURNING id`,
      [facAccountIds, facultyRows.map((f) => f.name), facultyRows.map((f) => f.email),
        facultyRows.map((f) => f.department), facultyRows.map((f) => f.designation),
        facultyRows.map((_, i) => `+91 98450 ${String(10000 + i).slice(-5)}`)]
    );
    const facultyIds = facIdRows.map((r) => r.id); // [0] = krao, [1] = smenon

    // ---- Students ----------------------------------------------------------
    const studentRows = [
      { username: 'stu_pnair', name: 'Priya Nair', roll: 'PES1UG24CS045', email: 'pnair@student.srs.example.edu', department: 'CSE', batch: '2024' },
    ];
    for (let i = 1; i < Math.max(studentCount, 1); i++) {
      const roll = `PES1UG24CS${String(100 + i).padStart(3, '0')}`;
      studentRows.push({
        username: roll.toLowerCase(),
        name: `${pick(FIRST)} ${pick(LAST)}`,
        roll,
        email: `${roll.toLowerCase()}@student.srs.example.edu`,
        department: DEPARTMENTS[i % DEPARTMENTS.length],
        batch: i % 4 === 0 ? '2023' : '2024',
      });
    }
    const stuAccountIds = await insertAccounts(
      client, studentRows.map((s) => ({ username: s.username, email: s.email, hash: hash.STUDENT, role: 'STUDENT' }))
    );
    const { rows: stuIdRows } = await client.query(
      `INSERT INTO students (account_id, roll_number, name, email, department, batch, phone)
       SELECT * FROM UNNEST($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) RETURNING id`,
      [stuAccountIds, studentRows.map((s) => s.roll), studentRows.map((s) => s.name), studentRows.map((s) => s.email),
        studentRows.map((s) => s.department), studentRows.map((s) => s.batch),
        studentRows.map((_, i) => `+91 90080 ${String(20000 + i).slice(-5)}`)]
    );
    const studentIds = stuIdRows.map((r) => r.id); // [0] = Priya Nair

    // ---- Courses + components --------------------------------------------
    const { rows: courseIdRows } = await client.query(
      `INSERT INTO courses (code, name, credits)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::int[]) RETURNING id`,
      [COURSES.map((c) => c[0]), COURSES.map((c) => c[1]), COURSES.map((c) => c[2])]
    );
    const courseIds = courseIdRows.map((r) => r.id);
    const courseByCode = Object.fromEntries(COURSES.map((c, i) => [c[0], courseIds[i]]));
    const componentIds = {}; // courseId -> [ids]
    for (const cid of courseIds) {
      const { rows } = await client.query(
        `INSERT INTO assessment_components (course_id, name, max_marks, position)
         SELECT $1, * FROM UNNEST($2::text[], $3::numeric[], $4::int[]) RETURNING id`,
        [cid, COMPONENTS.map((c) => c[0]), COMPONENTS.map((c) => c[1]), COMPONENTS.map((_, i) => i)]
      );
      componentIds[cid] = rows.map((r) => r.id);
    }

    // ---- Assignments (one faculty per course) -----------------------------
    const assignment = {}; // courseId -> facultyId
    courseIds.forEach((cid, i) => {
      const code = COURSES[i][0];
      if (code === 'UE24CS205' || code === 'UE24CS220') assignment[cid] = facultyIds[0]; // krao
      else if (code === 'UE24CS210') assignment[cid] = facultyIds[1]; // smenon
      else assignment[cid] = facultyIds[2 + (i % Math.max(facultyIds.length - 2, 1))] || facultyIds[1];
    });
    await client.query(
      `INSERT INTO course_assignments (course_id, faculty_id) SELECT * FROM UNNEST($1::int[], $2::int[])`,
      [Object.keys(assignment).map(Number), Object.values(assignment)]
    );

    // ---- Enrollments ------------------------------------------------------
    const enrollPairs = [];
    const priyaCourses = ['UE24CS205', 'UE24CS220', 'UE24CS230'].map((c) => courseByCode[c]);
    priyaCourses.forEach((cid) => enrollPairs.push([studentIds[0], cid]));
    for (let i = 1; i < studentIds.length; i++) {
      // Each generated student takes 3 consecutive courses (deterministic), giving ~90 per course.
      const start = i % courseIds.length;
      for (let k = 0; k < 3; k++) enrollPairs.push([studentIds[i], courseIds[(start + k) % courseIds.length]]);
    }
    const { rows: enrRows } = await client.query(
      `INSERT INTO enrollments (student_id, course_id)
       SELECT * FROM UNNEST($1::int[], $2::int[]) RETURNING id, student_id, course_id`,
      [enrollPairs.map((p) => p[0]), enrollPairs.map((p) => p[1])]
    );

    // ---- Attendance (past sessions; none on 2026-09-10) -------------------
    const attEnr = []; const attDate = []; const attStatus = [];
    for (const e of enrRows) {
      for (const d of SESSION_DATES) {
        attEnr.push(e.id);
        attDate.push(d);
        attStatus.push(rand() < 0.86 ? 'PRESENT' : 'ABSENT');
      }
    }
    await client.query(
      `INSERT INTO attendance (enrollment_id, session_date, status)
       SELECT * FROM UNNEST($1::int[], $2::date[], $3::text[])`,
      [attEnr, attDate, attStatus]
    );

    // ---- Marks (Internal Assessment 1 for every course except UE24CS205) --
    const mEnr = []; const mComp = []; const mVal = [];
    for (const e of enrRows) {
      if (e.course_id === courseByCode.UE24CS205) continue;
      mEnr.push(e.id);
      mComp.push(componentIds[e.course_id][0]);
      mVal.push(Math.round((8 + rand() * 12) * 2) / 2); // 8.0 - 20.0 in 0.5 steps
    }
    await client.query(
      `INSERT INTO marks (enrollment_id, component_id, marks_obtained)
       SELECT * FROM UNNEST($1::int[], $2::int[], $3::numeric[])`,
      [mEnr, mComp, mVal]
    );

    await client.query('COMMIT');
    if (log) {
      console.log(`[seed] 1 administrator, ${facultyIds.length} faculty, ${studentIds.length} students, ` +
        `${courseIds.length} courses, ${enrRows.length} enrollments, ${attEnr.length} attendance rows, ${mEnr.length} marks.`);
      console.log('[seed] Sample logins: admin01/Admin@123  fac_krao/Faculty@123  stu_pnair/Student@123');
    }
    return { facultyIds, studentIds, courseByCode, componentIds };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    release();
  }
}

module.exports = { seed, PASSWORDS };
