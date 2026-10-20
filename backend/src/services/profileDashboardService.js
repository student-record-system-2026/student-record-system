'use strict';

/**
 * Profile / Dashboard aggregation (FR-11, FR-12, FR-13; SADS 3.7).
 * Aggregates data for the caller only; scope comes from the session principal.
 */
const studentRepository = require('../repositories/studentRepository');
const facultyRepository = require('../repositories/facultyRepository');
const courseRepository = require('../repositories/courseRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');
const attendanceService = require('./attendanceService');
const marksService = require('./marksService');
const authz = require('./authorizationService');
const { ROLES } = require('./roles');
const { NotFoundError } = require('../errors/AppError');

function publicStudent(s) {
  const { accountId, ...rest } = s; // eslint-disable-line no-unused-vars
  return rest;
}
function publicFaculty(f) {
  const { accountId, ...rest } = f; // eslint-disable-line no-unused-vars
  return rest;
}

/** GET /api/profile - Student: own profile + enrolled courses (FR-11);
 *  Faculty: own profile + assigned courses + enrolled students per course (FR-12). */
async function getProfile(actor) {
  authz.assertRole(actor, ROLES.STUDENT, ROLES.FACULTY);
  if (actor.role === ROLES.STUDENT) {
    const student = await studentRepository.findById(actor.studentId);
    if (!student) throw new NotFoundError('Profile not found.');
    const enrolledCourses = await enrollmentRepository.listActiveByStudent(actor.studentId);
    return { role: actor.role, profile: publicStudent(student), enrolledCourses };
  }
  const faculty = await facultyRepository.findById(actor.facultyId);
  if (!faculty) throw new NotFoundError('Profile not found.');
  const courses = await assignmentRepository.listCoursesByFaculty(actor.facultyId);
  const assignedCourses = [];
  for (const c of courses) {
    const students = await enrollmentRepository.listActiveByCourse(c.id);
    assignedCourses.push({
      ...c,
      students: students.map(({ studentId, rollNumber, name, email, department, batch }) => ({
        studentId, rollNumber, name, email, department, batch,
      })),
    });
  }
  return { role: actor.role, profile: publicFaculty(faculty), assignedCourses };
}

/** GET /api/dashboard - role-specific summary with quick links (FR-13, SRS 4.8.2). */
async function getDashboard(actor) {
  authz.assertAuthenticated(actor);

  if (actor.role === ROLES.ADMIN) {
    const [students, faculty, courses] = await Promise.all([
      studentRepository.countByStatus(),
      facultyRepository.countByStatus(),
      courseRepository.countByStatus(),
    ]);
    return {
      role: actor.role,
      displayName: actor.displayName,
      counts: { students, faculty, courses },
      links: [
        { label: 'Manage Students', path: '/admin/students' },
        { label: 'Manage Faculty', path: '/admin/faculty' },
        { label: 'Manage Courses', path: '/admin/courses' },
        { label: 'Faculty-Course Assignment', path: '/admin/assignments' },
        { label: 'Student Enrollment', path: '/admin/enrollments' },
      ],
    };
  }

  if (actor.role === ROLES.FACULTY) {
    const courses = await assignmentRepository.listCoursesByFaculty(actor.facultyId);
    return {
      role: actor.role,
      displayName: actor.displayName,
      assignedCourses: courses.map((c) => ({
        ...c,
        links: [
          { label: 'Attendance', path: `/faculty/courses/${c.id}/attendance` },
          { label: 'Marks', path: `/faculty/courses/${c.id}/marks` },
        ],
      })),
      totals: {
        courses: courses.length,
        students: courses.reduce((s, c) => s + c.enrolledCount, 0),
      },
      links: [{ label: 'My Profile', path: '/faculty/profile' }],
    };
  }

  // Student
  const [attendance, marks] = await Promise.all([
    attendanceService.getStudentAttendance(actor, actor.studentId),
    marksService.getStudentMarks(actor, actor.studentId),
  ]);
  const enrolledCourses = attendance.courses.map((a) => {
    const m = marks.courses.find((x) => x.courseId === a.courseId) || {};
    return {
      courseId: a.courseId, code: a.code, name: a.name, facultyName: a.facultyName,
      attendance: { present: a.present, total: a.total, percentage: a.percentage },
      marks: {
        enteredCount: m.enteredCount || 0,
        componentCount: (m.components || []).length,
        totalObtained: m.totalObtained || 0,
        totalMaxEntered: m.totalMaxEntered || 0,
      },
    };
  });
  return {
    role: actor.role,
    displayName: actor.displayName,
    enrolledCourses,
    links: [
      { label: 'My Profile', path: '/student/profile' },
      { label: 'My Attendance', path: '/student/attendance' },
      { label: 'My Marks', path: '/student/marks' },
    ],
  };
}

module.exports = { getProfile, getDashboard };
