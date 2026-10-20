/**
 * UI tests - Login, role-based redirect, RBAC screen guard and logout
 * (TC-01, TC-07 steps 3/6/8, TC-10 step 6; FR-1, SO-3, NFR-8 / GitHub #10, #22, #30, #31).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { mockApi, renderApp, UNAUTH, USERS } from './helpers';

const adminDashboard = {
  role: 'ADMIN', displayName: 'Administrator',
  counts: { students: { total: 300, active: 299 }, faculty: { total: 20, active: 20 }, courses: { total: 10, active: 10 } },
  links: [{ label: 'Manage Students', path: '/admin/students' }],
};
const studentDashboard = { role: 'STUDENT', displayName: 'Priya Nair', enrolledCourses: [], links: [] };

describe('Login screen (FR-1)', () => {
  test('empty submission shows required-field messages without calling the API', async () => {
    const { calls } = mockApi({ 'GET /api/auth/session': UNAUTH });
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Username or email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/auth/login')).toBe(false);
  });

  test('invalid credentials show the server error and stay on the login page (TC-01 step 8)', async () => {
    mockApi({
      'GET /api/auth/session': UNAUTH,
      'POST /api/auth/login': { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } } },
    });
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Username or email'), 'stu_pnair');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.');
    expect(screen.getByLabelText('Password')).toHaveValue(''); // password cleared
  });

  test('valid login redirects to the role dashboard returned by the server (TC-01 step 2)', async () => {
    mockApi({
      'GET /api/auth/session': UNAUTH,
      'POST /api/auth/login': { user: USERS.admin, redirectTo: '/admin' },
      'GET /api/dashboard': adminDashboard,
    });
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Username or email'), 'admin01');
    await userEvent.type(screen.getByLabelText('Password'), 'Admin@123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Administrator Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
  });
});

describe('Role-based screen access (SO-3)', () => {
  test('unauthenticated user opening a protected screen is sent to the login page', async () => {
    mockApi({ 'GET /api/auth/session': UNAUTH });
    renderApp('/admin/students');
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  test('a Student opening Manage Students sees "Access denied" (TC-01 step 7)', async () => {
    const { calls } = mockApi({ 'GET /api/auth/session': { user: USERS.student } });
    renderApp('/admin/students');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(calls.some((c) => c.url.startsWith('/api/students'))).toBe(false); // no data requested
  });

  test('a Faculty member opening a Student screen sees "Access denied"', async () => {
    mockApi({ 'GET /api/auth/session': { user: USERS.faculty } });
    renderApp('/student/marks');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });

  test('navigation shows only the links for the user\'s role', async () => {
    mockApi({ 'GET /api/auth/session': { user: USERS.student }, 'GET /api/dashboard': studentDashboard });
    renderApp('/student');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(nav).toHaveTextContent('Attendance');
    expect(nav).not.toHaveTextContent('Students');
    expect(nav).not.toHaveTextContent('Courses');
  });
});

describe('Logout and session termination (FR-14, NFR-8)', () => {
  test('Log out calls the API, returns to the login screen, and protected screens are no longer reachable', async () => {
    const { calls } = mockApi({
      'GET /api/auth/session': { user: USERS.student },
      'GET /api/dashboard': studentDashboard,
      'POST /api/auth/logout': { message: 'You have been logged out.' },
    });
    renderApp('/student');
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('You have been logged out.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.url === '/api/auth/logout')).toBe(true);
  });

  test('a 401 from any data request (terminated session) drops the user back to login', async () => {
    mockApi({ 'GET /api/auth/session': { user: USERS.student }, 'GET /api/dashboard': UNAUTH });
    renderApp('/student');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument());
    expect(screen.getByText('Your session has ended. Please log in again.')).toBeInTheDocument();
  });
});
