/**
 * UI tests - Faculty attendance/marks entry and Student views
 * (TC-05, TC-06; FR-7, FR-8, FR-9, FR-10 / GitHub #16, #17, #18, #19).
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { mockApi, renderApp, USERS } from './helpers';

const course = { id: 1, code: 'UE24CS205', name: 'Software Engineering', status: 'ACTIVE' };
const roster = [
  { studentId: 1, rollNumber: 'PES1UG24CS045', name: 'Priya Nair' },
  { studentId: 2, rollNumber: 'PES1UG24CS101', name: 'Rohan Iyer' },
];

describe('Faculty attendance (FR-7)', () => {
  test('records a new session with each student marked Present/Absent (POST)', async () => {
    const { calls } = mockApi({
      'GET /api/auth/session': { user: USERS.faculty },
      'GET /api/courses/1/attendance': { course, roster, sessions: [], summary: [] },
      'POST /api/courses/1/attendance': { status: 201, body: { course, roster, sessions: [], summary: [], message: 'Attendance saved.' } },
    });
    renderApp('/faculty/courses/1/attendance');
    const date = await screen.findByLabelText('Session date');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-09-10');
    await userEvent.click(screen.getByLabelText('Rohan Iyer absent'));
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    expect(await screen.findByText(/Attendance saved\./)).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(post.body).toEqual({
      sessionDate: '2026-09-10',
      records: [{ studentId: 1, status: 'PRESENT' }, { studentId: 2, status: 'ABSENT' }],
    });
  });

  test('reopening a recorded date loads saved values and updates with PUT', async () => {
    const sessions = [{ sessionDate: '2026-09-03', present: 1, absent: 1, records: [
      { studentId: 1, status: 'PRESENT' }, { studentId: 2, status: 'ABSENT' }] }];
    const { calls } = mockApi({
      'GET /api/auth/session': { user: USERS.faculty },
      'GET /api/courses/1/attendance': { course, roster, sessions, summary: [] },
      'PUT /api/courses/1/attendance/2026-09-03': { course, roster, sessions, summary: [], message: 'Attendance updated.' },
    });
    renderApp('/faculty/courses/1/attendance');
    await userEvent.click(await screen.findByRole('button', { name: /03 Sep 2026|Sep 03, 2026|2026/ }));
    expect(screen.getByText('Editing recorded session')).toBeInTheDocument();
    expect(screen.getByLabelText('Rohan Iyer absent')).toBeChecked();
    await userEvent.click(screen.getByLabelText('Priya Nair absent'));
    await userEvent.click(screen.getByRole('button', { name: 'Update attendance' }));
    expect(await screen.findByText(/Attendance updated\./)).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put.body.records).toEqual([{ studentId: 1, status: 'ABSENT' }, { studentId: 2, status: 'ABSENT' }]);
  });

  test('a course not assigned to the faculty member shows Access denied (TC-05 step 4)', async () => {
    mockApi({
      'GET /api/auth/session': { user: USERS.faculty },
      'GET /api/courses/2/attendance': { status: 403, body: { error: { code: 'FORBIDDEN', message: 'You are not authorized for this course.' } } },
    });
    renderApp('/faculty/courses/2/attendance');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.getByText('You are not authorized for this course.')).toBeInTheDocument();
  });
});

describe('Faculty marks (FR-9)', () => {
  const sheet = (marks = {}) => ({
    course,
    components: [{ id: 5, name: 'Internal Assessment 1', maxMarks: 20 }],
    enteredComponentIds: Object.keys(marks).length ? [5] : [],
    students: roster.map((s) => ({ ...s, marks: marks[s.studentId] !== undefined ? { 5: marks[s.studentId] } : {} })),
  });

  test('first entry uses POST; an out-of-range value shows the server error on that row', async () => {
    const { calls } = mockApi({
      'GET /api/auth/session': { user: USERS.faculty },
      'GET /api/courses/1/marks': sheet(),
      'POST /api/courses/1/marks': (body) => (body.marks[0].marksObtained === '25'
        ? { status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'Marks must be between 0 and 20 for Internal Assessment 1.',
          details: [{ field: 'marks[0].marksObtained', issue: 'out_of_range', message: 'Marks must be between 0 and 20 for Internal Assessment 1.' }] } } }
        : { status: 201, body: { ...sheet({ 1: 17 }), message: 'Marks saved.' } }),
    });
    renderApp('/faculty/courses/1/marks');
    const input = await screen.findByLabelText('Marks for Priya Nair');
    await userEvent.type(input, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Save marks' }));
    expect(await screen.findAllByText('Marks must be between 0 and 20 for Internal Assessment 1.')).toHaveLength(2);
    expect(input).toHaveAttribute('aria-invalid', 'true');

    await userEvent.clear(input);
    await userEvent.type(input, '17');
    await userEvent.click(screen.getByRole('button', { name: 'Save marks' }));
    expect(await screen.findByText(/Marks saved\./)).toBeInTheDocument();
    const last = calls.filter((c) => c.method === 'POST').pop();
    expect(last.body).toEqual({ componentId: 5, marks: [{ studentId: 1, marksObtained: '17' }] });
  });

  test('editing previously entered marks uses PUT', async () => {
    const { calls } = mockApi({
      'GET /api/auth/session': { user: USERS.faculty },
      'GET /api/courses/1/marks': sheet({ 1: 17 }),
      'PUT /api/courses/1/marks/5': { ...sheet({ 1: 18 }), message: 'Marks updated.' },
    });
    renderApp('/faculty/courses/1/marks');
    const input = await screen.findByLabelText('Marks for Priya Nair');
    expect(input).toHaveValue('17');
    await userEvent.clear(input);
    await userEvent.type(input, '18');
    await userEvent.click(screen.getByRole('button', { name: 'Save marks' }));
    expect(await screen.findByText(/Marks updated\./)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT').body).toEqual({ marks: [{ studentId: 1, marksObtained: '18' }] });
  });
});

describe('Student views (FR-8, FR-10)', () => {
  test('attendance view shows session-wise records and the percentage', async () => {
    const data = { studentId: 1, courses: [{ courseId: 1, code: 'UE24CS205', name: 'Software Engineering', present: 3, absent: 1, total: 4, percentage: 75,
      sessions: [{ sessionDate: '2026-09-10', status: 'ABSENT' }, { sessionDate: '2026-09-03', status: 'PRESENT' }] }] };
    mockApi({ 'GET /api/auth/session': { user: USERS.student }, 'GET /api/students/1/attendance': data });
    renderApp('/student/attendance');
    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(screen.getByText('3 present / 4 sessions')).toBeInTheDocument();
    expect(screen.getAllByText('Absent').length).toBeGreaterThan(0);
  });

  test('attendance for a course the student is not enrolled in shows Access denied (TC-05 step 7)', async () => {
    mockApi({
      'GET /api/auth/session': { user: USERS.student },
      'GET /api/students/1/attendance': { studentId: 1, courses: [] },
      'GET /api/students/1/attendance?courseId=2': { status: 403, body: { error: { code: 'FORBIDDEN', message: 'You are not enrolled in this course.' } } },
    });
    renderApp('/student/attendance?courseId=2');
    expect(await screen.findByText('You are not enrolled in this course.')).toBeInTheDocument();
  });

  test('marks view shows marks obtained per component (TC-06 step 6: 18/20)', async () => {
    const data = { studentId: 1, courses: [{ courseId: 1, code: 'UE24CS205', name: 'Software Engineering', enteredCount: 1, totalObtained: 18, totalMaxEntered: 20,
      components: [{ componentId: 5, name: 'Internal Assessment 1', maxMarks: 20, marksObtained: 18 }, { componentId: 6, name: 'Assignment', maxMarks: 10, marksObtained: null }] }] };
    mockApi({ 'GET /api/auth/session': { user: USERS.student }, 'GET /api/students/1/marks': data });
    renderApp('/student/marks');
    const row = (await screen.findByText('Internal Assessment 1')).closest('tr');
    expect(within(row).getByText('18')).toBeInTheDocument();
    expect(within(row).getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Not entered')).toBeInTheDocument();
  });
});
