import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../src/App';
import { AuthProvider } from '../src/auth/AuthContext';

/**
 * Install a fake fetch. `routes` maps "METHOD /api/path" (query string ignored unless included)
 * to a handler returning { status, body } or a body object (status 200).
 */
export function mockApi(routes) {
  const calls = [];
  const fetchMock = vi.fn(async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const full = `${method} ${url}`;
    const path = `${method} ${url.split('?')[0]}`;
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url, body });
    const handler = routes[full] ?? routes[path];
    let result = typeof handler === 'function' ? handler(body, url) : handler;
    if (result === undefined) result = { status: 404, body: { error: { code: 'NOT_FOUND', message: `No mock for ${full}` } } };
    const { status = 200, body: resBody = result } = result && result.status ? result : { body: result };
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(resBody),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

export const UNAUTH = { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'Please log in.' } } };

export const USERS = {
  admin: { username: 'admin01', role: 'ADMIN', displayName: 'Administrator', studentId: null, facultyId: null, dashboard: '/admin' },
  faculty: { username: 'fac_krao', role: 'FACULTY', displayName: 'Dr. Kavita Rao', studentId: null, facultyId: 1, dashboard: '/faculty' },
  student: { username: 'stu_pnair', role: 'STUDENT', displayName: 'Priya Nair', studentId: 1, facultyId: null, dashboard: '/student' },
};

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}
