/**
 * UI tests - FR-14 User Logout (GitHub #23): every role can log out from any screen,
 * and the user always ends up on the login screen even if the server session had already ended.
 * Complements auth.test.jsx (Student logout, 401 handling).
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { mockApi, renderApp, UNAUTH, USERS } from './helpers';

const DASHBOARDS = {
  admin: {
    role: 'ADMIN', displayName: 'Administrator',
    counts: { students: { total: 1, active: 1 }, faculty: { total: 1, active: 1 }, courses: { total: 1, active: 1 } },
    links: [],
  },
  faculty: { role: 'FACULTY', displayName: 'Dr. Kavita Rao', totals: { courses: 0, students: 0 }, assignedCourses: [], links: [] },
  student: { role: 'STUDENT', displayName: 'Priya Nair', enrolledCourses: [], links: [] },
};

describe('FR-14 Logout is available to every role', () => {
  test.each([
    ['Administrator', 'admin', '/admin'],
    ['Faculty', 'faculty', '/faculty'],
    ['Student', 'student', '/student'],
  ])('%s sees a Log out button in the top bar and returns to the login screen after using it', async (_label, role, path) => {
    const { calls } = mockApi({
      'GET /api/auth/session': { user: USERS[role] },
      'GET /api/dashboard': DASHBOARDS[role],
      'POST /api/auth/logout': { message: 'You have been logged out.' },
    });
    renderApp(path);
    const banner = await screen.findByRole('banner');
    await userEvent.click(within(banner).getByRole('button', { name: 'Log out' }));

    expect(await screen.findByText('You have been logged out.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST' && c.url === '/api/auth/logout')).toHaveLength(1);
  });
});

describe('FR-14 Logout when the server session has already ended', () => {
  test('the server answering 401 to logout still returns the user to the login screen', async () => {
    mockApi({
      'GET /api/auth/session': { user: USERS.faculty },
      'GET /api/dashboard': DASHBOARDS.faculty,
      'POST /api/auth/logout': UNAUTH,
    });
    renderApp('/faculty');
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByText('Dr. Kavita Rao')).not.toBeInTheDocument();
  });

  test('after logout, opening a protected screen again shows the login screen, not cached data', async () => {
    const routes = {
      'GET /api/auth/session': { user: USERS.admin },
      'GET /api/dashboard': DASHBOARDS.admin,
      'POST /api/auth/logout': () => {
        routes['GET /api/auth/session'] = UNAUTH; // the server no longer knows this session
        return { message: 'You have been logged out.' };
      },
    };
    mockApi(routes);
    const first = renderApp('/admin');
    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    await screen.findByRole('button', { name: 'Log in' });
    first.unmount();

    renderApp('/admin/students'); // e.g. browser Back / reopening a bookmarked screen
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Students/ })).not.toBeInTheDocument();
  });
});
