/**
 * HTTP client for the Controller/API Layer (SADS 4.3). The Presentation Layer talks to the
 * backend only through this module. The session lives in an HttpOnly cookie; the browser
 * sends it automatically (same origin via the Vite proxy / Express static hosting).
 */

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Map SADS-envelope details [{ field, message }] to { field: message } for forms. */
  fieldErrors() {
    const out = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details) if (d.field && !out[d.field]) out[d.field] = d.message;
    }
    return out;
  }
}

let unauthorizedHandler = null;
/** Registered by AuthContext: called when a protected request returns 401 (session ended). */
export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

async function request(method, path, body, { silent401 = false } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that the backend is running.');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = null;
    }
  }

  if (!res.ok) {
    const err = (data && data.error) || {};
    const apiError = new ApiError(
      res.status,
      err.code || 'HTTP_' + res.status,
      err.message || `Request failed (${res.status}).`,
      err.details
    );
    if (res.status === 401 && !silent401 && unauthorizedHandler) unauthorizedHandler(apiError);
    throw apiError;
  }
  return data;
}

const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries).toString() : '';
};

export const api = {
  // Authentication (FR-1, FR-14)
  login: (username, password) => request('POST', '/auth/login', { username, password }, { silent401: true }),
  logout: () => request('POST', '/auth/logout', undefined, { silent401: true }),
  session: () => request('GET', '/auth/session', undefined, { silent401: true }),

  // Dashboard / profile (FR-11, FR-12, FR-13)
  dashboard: () => request('GET', '/dashboard'),
  profile: () => request('GET', '/profile'),

  // Students (FR-2)
  listStudents: (params) => request('GET', '/students' + qs(params)),
  getStudent: (id) => request('GET', `/students/${id}`),
  createStudent: (data) => request('POST', '/students', data),
  updateStudent: (id, data) => request('PUT', `/students/${id}`, data),
  deactivateStudent: (id) => request('PATCH', `/students/${id}/deactivate`),
  studentAttendance: (id, courseId) => request('GET', `/students/${id}/attendance` + qs({ courseId })),
  studentMarks: (id, courseId) => request('GET', `/students/${id}/marks` + qs({ courseId })),

  // Faculty (FR-3)
  listFaculty: (params) => request('GET', '/faculty' + qs(params)),
  getFaculty: (id) => request('GET', `/faculty/${id}`),
  createFaculty: (data) => request('POST', '/faculty', data),
  updateFaculty: (id, data) => request('PUT', `/faculty/${id}`, data),
  deactivateFaculty: (id) => request('PATCH', `/faculty/${id}/deactivate`),

  // Courses (FR-4)
  listCourses: (params) => request('GET', '/courses' + qs(params)),
  getCourse: (id) => request('GET', `/courses/${id}`),
  createCourse: (data) => request('POST', '/courses', data),
  updateCourse: (id, data) => request('PUT', `/courses/${id}`, data),
  deleteCourse: (id) => request('DELETE', `/courses/${id}`),

  // Assignment / enrollment (FR-5, FR-6)
  getAssignment: (courseId) => request('GET', `/courses/${courseId}/assignment`),
  assignFaculty: (courseId, facultyId) => request('POST', `/courses/${courseId}/assignment`, { facultyId }),
  reassignFaculty: (courseId, facultyId) => request('PUT', `/courses/${courseId}/assignment`, { facultyId }),
  removeAssignment: (courseId) => request('DELETE', `/courses/${courseId}/assignment`),
  listEnrollments: (courseId) => request('GET', `/courses/${courseId}/enrollments`),
  enrollStudent: (courseId, studentId) => request('POST', `/courses/${courseId}/enrollments`, { studentId }),
  removeEnrollment: (courseId, studentId) => request('DELETE', `/courses/${courseId}/enrollments/${studentId}`),

  // Attendance (FR-7)
  courseAttendance: (courseId, date) => request('GET', `/courses/${courseId}/attendance` + qs({ date })),
  recordAttendance: (courseId, sessionDate, records) =>
    request('POST', `/courses/${courseId}/attendance`, { sessionDate, records }),
  updateAttendance: (courseId, sessionDate, records) =>
    request('PUT', `/courses/${courseId}/attendance/${sessionDate}`, { records }),

  // Marks (FR-9)
  courseMarks: (courseId) => request('GET', `/courses/${courseId}/marks`),
  enterMarks: (courseId, componentId, marks) => request('POST', `/courses/${courseId}/marks`, { componentId, marks }),
  updateMarks: (courseId, componentId, marks) => request('PUT', `/courses/${courseId}/marks/${componentId}`, { marks }),
};
