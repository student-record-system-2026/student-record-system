'use strict';

/**
 * Request-shape schemas for each feature area (Controller/API Layer validation, NFR-4).
 * Business-rule checks (e.g. marks <= component maximum, enrollment scoping) live in services.
 */

const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
const NAME_MSG = "may contain only letters, spaces, and . ' - characters.";

const STATUS_VALUES = ['ACTIVE', 'INACTIVE'];

const name = (label) => ({
  type: 'string', label, required: true, min: 2, max: 100, pattern: NAME_RE, patternMessage: `${label} ${NAME_MSG}`,
});
const phone = {
  type: 'string', label: 'Phone', required: false, max: 20,
  pattern: /^\+?[0-9][0-9 -]{6,18}$/, patternMessage: 'Phone must contain 7-20 digits (spaces, - and a leading + allowed).',
};
const department = { type: 'string', label: 'Department', required: true, min: 2, max: 50 };
const username = {
  type: 'string', label: 'Username', required: false, min: 3, max: 50,
  pattern: /^[A-Za-z0-9._-]+$/, patternMessage: 'Username may contain only letters, digits, and . _ - characters.',
};

// ---- FR-1 -------------------------------------------------------------------
const login = {
  username: { type: 'string', label: 'Username or email', required: true, max: 120 },
  password: { type: 'string', label: 'Password', required: true, max: 200 },
};

// ---- FR-2 -------------------------------------------------------------------
const studentFields = {
  name: name('Name'),
  rollNumber: {
    type: 'string', label: 'Roll number', required: true, min: 3, max: 20, case: 'upper',
    pattern: /^[A-Z0-9]+$/, patternMessage: 'Roll number may contain only letters and digits.',
  },
  email: { type: 'email', label: 'Contact email', required: true, max: 120, case: 'lower' },
  phone,
  department,
  batch: {
    type: 'string', label: 'Batch', required: true, pattern: /^(19|20)\d{2}$/,
    patternMessage: 'Batch must be a 4-digit year (e.g. 2024).',
  },
};
const studentCreate = {
  ...studentFields,
  username,
  password: { type: 'password', label: 'Initial password', required: true },
};
const studentUpdate = {
  ...studentFields,
  status: { type: 'enum', label: 'Status', required: false, values: STATUS_VALUES },
};

// ---- FR-3 -------------------------------------------------------------------
const facultyFields = {
  name: name('Name'),
  email: { type: 'email', label: 'Contact email', required: true, max: 120, case: 'lower' },
  phone,
  department,
  designation: { type: 'string', label: 'Designation', required: false, max: 50 },
};
const facultyCreate = {
  ...facultyFields,
  username,
  password: { type: 'password', label: 'Initial password', required: true },
};
const facultyUpdate = {
  ...facultyFields,
  status: { type: 'enum', label: 'Status', required: false, values: STATUS_VALUES },
};

// ---- FR-4 -------------------------------------------------------------------
const courseFields = {
  code: {
    type: 'string', label: 'Course code', required: true, min: 2, max: 20, case: 'upper',
    pattern: /^[A-Z0-9-]+$/, patternMessage: 'Course code may contain only letters, digits, and hyphens.',
  },
  name: { type: 'string', label: 'Course name', required: true, min: 2, max: 120 },
  credits: { type: 'int', label: 'Credits', required: true, min: 1, max: 10 },
};
const courseUpdate = {
  ...courseFields,
  status: { type: 'enum', label: 'Status', required: false, values: STATUS_VALUES },
};
const component = {
  id: { type: 'int', label: 'Component id', required: false, min: 1 },
  name: { type: 'string', label: 'Component name', required: true, min: 1, max: 60 },
  maxMarks: { type: 'number', label: 'Maximum marks', required: true, exclusiveMin: 0, max: 1000, decimals: 2 },
};

// ---- FR-5 / FR-6 ------------------------------------------------------------
const assignment = { facultyId: { type: 'int', label: 'Faculty', required: true, min: 1 } };
const enrollment = { studentId: { type: 'int', label: 'Student', required: true, min: 1 } };

// ---- FR-7 -------------------------------------------------------------------
const sessionDate = { type: 'date', label: 'Session date', required: true, notFuture: true };
const attendanceRecord = {
  studentId: { type: 'int', label: 'Student', required: true, min: 1 },
  status: { type: 'enum', label: 'Attendance status', required: true, values: ['PRESENT', 'ABSENT'] },
};

// ---- FR-9 -------------------------------------------------------------------
const marksEntry = {
  studentId: { type: 'int', label: 'Student', required: true, min: 1 },
  marksObtained: { type: 'number', label: 'Marks', required: true, min: 0, decimals: 2 },
};

// ---- list filters ----------------------------------------------------------
const listQuery = {
  search: { type: 'string', label: 'Search', required: false, max: 100 },
  status: { type: 'enum', label: 'Status', required: false, values: STATUS_VALUES },
};

module.exports = {
  login, studentCreate, studentUpdate, facultyCreate, facultyUpdate, courseFields, courseUpdate,
  component, assignment, enrollment, sessionDate, attendanceRecord, marksEntry, listQuery,
};
