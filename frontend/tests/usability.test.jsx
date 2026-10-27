/**
 * NFR-3 Usability (GitHub #26) - automated pre-checks for the TC-09 usability walkthrough.
 *
 * NFR-3: "A first-time user in each role shall be able to complete their core task ... without
 * external help", verified by a walkthrough with at least three representative users (TC-09 steps 1-3).
 * The walkthrough itself is run with real people (docs/Sprint2/TC-09_Usability_Walkthrough.md).
 * These tests check, on every PR, the properties that let a first-time user succeed unaided:
 *  - each core task is reachable in at most two clicks from the user's dashboard,
 *  - every form control has a visible label and required fields are marked,
 *  - success and error feedback is shown as an announced message, and
 *  - every screen has the same top bar, navigation and page heading.
 * Core tasks (TC-09 Test Parameters): Administrator - create a new student record;
 * Faculty - record attendance for one session; Student - view attendance and marks.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { mockApi, renderApp, UNAUTH, USERS } from './helpers';

const course = { id: 1, code: 'UE24CS205', name: 'Software Engineering', status: 'ACTIVE' };
const roster = [
  { studentId: 1, rollNumber: 'PES1UG24CS045', name: 'Priya Nair' },
  { studentId: 2, rollNumber: 'PES1UG24CS101', name: 'Rohan Iyer' },
];

/** Every input/select/textarea must have a label the user can read (label element or aria-label). */
function unlabelledControls(container) {
  const controls = [...container.querySelectorAll('input, select, textarea')].filter(
    (el) => !['hidden', 'submit', 'button'].includes(el.type)
  );
  return controls.filter((el) => {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
    if (el.id && container.querySelector(`label[for="${el.id}"]`)?.textContent.trim()) return false;
    if (el.closest('label')?.textContent.trim()) return false;
    return true;
  }).map((el) => el.outerHTML.slice(0, 80));
}

function expectStandardChrome() {
  const banner = screen.getByRole('banner');
  expect(within(banner).getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  expect(within(banner).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
}

describe('NFR-3 Login screen', () => {
  test('fields are labelled and a wrong password produces a clear, announced message', async () => {
    mockApi({
      'GET /api/auth/session': UNAUTH,
      'POST /api/auth/login': { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } } },
    });
    const { container } = renderApp('/login');
    await screen.findByRole('button', { name: 'Log in' });
    expect(unlabelledControls(container)).toEqual([]);
    await userEvent.type(screen.getByLabelText('Username or email'), 'admin01');
    await userEvent.type(screen.getByLabelText('Password'), 'nope1234');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.');
  });
});

describe('NFR-3 Administrator core task: create a new student record (TC-09 step 1)', () => {
  test('reachable in two clicks from the dashboard, with a fully labelled form', async () => {
    mockApi({
      'GET /api/auth/session': { user: USERS.admin },
      'GET /api/dashboard': {
        role: 'ADMIN', displayName: 'Administrator',
        counts: { students: { total: 300, active: 300 }, faculty: { total: 20, active: 20 }, courses: { total: 10, active: 10 } },
        links: [{ label: 'Manage Students', path: '/admin/students' }],
      },
      'GET /api/students': { students: [], total: 0 },
    });
    const { container } = renderApp('/admin');
    await screen.findByRole('heading', { name: 'Administrator Dashboard' });
    expectStandardChrome();

    // Click 1: the dashboard's quick link. Click 2: the clearly named "New student" button.
    await userEvent.click(screen.getByRole('link', { name: /Manage Students/ }));
    await userEvent.click(await screen.findByRole('link', { name: /New student/ }));
    expect(await screen.findByRole('heading', { name: 'New student' })).toBeInTheDocument();
    expectStandardChrome();

    expect(unlabelledControls(container)).toEqual([]);
    // Required fields carry a visible * marker in their label.
    for (const label of ['Full name', 'Roll number', 'Department', 'Batch', 'Contact email', 'Initial password']) {
      const field = screen.getByLabelText(new RegExp(label));
      expect(container.querySelector(`label[for="${field.id}"] .req`)).not.toBeNull();
    }
    expect(container.querySelector('label[for="f-phone"] .req')).toBeNull(); // optional field has no marker
    // Format hints tell a first-time user what to type.
    expect(screen.getByText(/e\.g\. PES1UG24CS099/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create student' })).toBeEnabled();
  });

  test('submitting with mistakes explains each problem next to the field instead of failing silently', async () => {
    mockApi({
      'GET /api/auth/session': { user: USERS.admin },
      'POST /api/students': { status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', details: [
        { field: 'name', issue: 'missing', message: 'Full name is required.' },
        { field: 'batch', issue: 'format', message: 'Batch must be a four-digit year, e.g. 2024.' },
      ] } } },
    });
    renderApp('/admin/students/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Create student' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please correct the highlighted fields.');
    const nameField = screen.getByLabelText(/Full name/);
    expect(nameField).toHaveAttribute('aria-invalid', 'true');
    expect(nameField).toHaveAccessibleDescription('Full name is required.');
    expect(screen.getByLabelText(/Batch/)).toHaveAccessibleDescription('Batch must be a four-digit year, e.g. 2024.');
    expect(screen.getByRole('heading', { name: 'New student' })).toBeInTheDocument(); // user stays on the form
  });
});

describe('NFR-3 Faculty core task: record attendance for one session (TC-09 step 2)', () => {
  test('one click from the dashboard course card; every control labelled; saving is confirmed', async () => {
    mockApi({
      'GET /api/auth/session': { user: USERS.faculty },
      'GET /api/dashboard': {
        role: 'FACULTY', displayName: 'Dr. Kavita Rao', totals: { courses: 1, students: 2 },
        assignedCourses: [{ ...course, credits: 4, enrolledCount: 2, links: [
          { label: 'Attendance', path: '/faculty/courses/1/attendance' },
          { label: 'Marks', path: '/faculty/courses/1/marks' },
        ] }],
        links: [],
      },
      'GET /api/courses/1/attendance': { course, roster, sessions: [], summary: [] },
      'POST /api/courses/1/attendance': { status: 201, body: { course, roster, sessions: [], summary: [], message: 'Attendance saved.' } },
    });
    const { container } = renderApp('/faculty');
    const card = (await screen.findByText('Software Engineering')).closest('article');
    await userEvent.click(within(card).getByRole('link', { name: 'Attendance' }));

    await screen.findByLabelText('Session date');
    expectStandardChrome();
    expect(unlabelledControls(container)).toEqual([]);
    // Each student has a clearly labelled Present / Absent choice.
    for (const s of roster) {
      expect(screen.getByLabelText(`${s.name} present`)).toBeInTheDocument();
      expect(screen.getByLabelText(`${s.name} absent`)).toBeInTheDocument();
    }
    const date = screen.getByLabelText('Session date');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-09-10');
    await userEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    expect(await screen.findByText(/Attendance saved\./)).toBeInTheDocument();
  });
});

describe('NFR-3 Student core task: view attendance and marks (TC-09 step 3)', () => {
  test('Attendance and Marks are one click away, both from the navigation bar and the dashboard', async () => {
    mockApi({
      'GET /api/auth/session': { user: USERS.student },
      'GET /api/dashboard': {
        role: 'STUDENT', displayName: 'Priya Nair', enrolledCourses: [],
        links: [
          { label: 'My Profile', path: '/student/profile' },
          { label: 'My Attendance', path: '/student/attendance' },
          { label: 'My Marks', path: '/student/marks' },
        ],
      },
      'GET /api/students/1/attendance': { courses: [] },
      'GET /api/students/1/marks': { courses: [] },
    });
    renderApp('/student');
    await screen.findByRole('heading', { name: 'Welcome, Priya Nair' });
    expectStandardChrome();

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Attendance' })).toHaveAttribute('href', '/student/attendance');
    expect(within(nav).getByRole('link', { name: 'Marks' })).toHaveAttribute('href', '/student/marks');
    expect(screen.getByRole('link', { name: 'My Attendance' })).toBeInTheDocument();

    await userEvent.click(within(nav).getByRole('link', { name: 'Attendance' }));
    expect(await screen.findByRole('heading', { name: 'My Attendance' })).toBeInTheDocument();
    expectStandardChrome();

    await userEvent.click(within(nav).getByRole('link', { name: 'Marks' }));
    expect(await screen.findByRole('heading', { name: 'My Marks' })).toBeInTheDocument();
    expectStandardChrome();
  });
});
