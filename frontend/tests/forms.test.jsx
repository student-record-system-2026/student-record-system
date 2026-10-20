/**
 * UI tests - record forms show server validation errors clearly (NFR-4) and the course
 * delete flow reports deactivation (FR-2, FR-4 / GitHub #11, #13, #27).
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { mockApi, renderApp, USERS } from './helpers';

describe('Student form (FR-2, NFR-4)', () => {
  test('blank Roll No: the server\'s field error is shown next to the field and no navigation happens', async () => {
    const { calls } = mockApi({
      'GET /api/auth/session': { user: USERS.admin },
      'POST /api/students': {
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', message: 'Roll number is required.', details: [{ field: 'rollNumber', issue: 'missing', message: 'Roll number is required.' }] } },
      },
    });
    renderApp('/admin/students/new');
    await userEvent.type(await screen.findByLabelText(/Full name/), 'Priya Nair');
    await userEvent.type(screen.getByLabelText(/Department/), 'CSE');
    await userEvent.type(screen.getByLabelText(/Batch/), '2024');
    await userEvent.type(screen.getByLabelText(/Contact email/), 'priya.nair@example.com');
    await userEvent.type(screen.getByLabelText(/Initial password/), 'Welcome@123');
    await userEvent.click(screen.getByRole('button', { name: 'Create student' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Roll number is required.');
    const roll = screen.getByLabelText(/Roll number/);
    expect(roll).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: 'New student' })).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.url === '/api/students');
    expect(post.body).toMatchObject({ name: 'Priya Nair', rollNumber: '', batch: '2024' });
  });

  test('successful create navigates to the new record with a confirmation', async () => {
    const student = { id: 7, name: 'Priya Nair', rollNumber: 'PES1UG24CS099', department: 'CSE', batch: '2024', email: 'priya.nair@example.com', phone: null, username: 'pes1ug24cs099', status: 'ACTIVE' };
    mockApi({
      'GET /api/auth/session': { user: USERS.admin },
      'POST /api/students': { status: 201, body: { student, message: 'Student record created.' } },
      'GET /api/students/7': { student: { ...student, enrollments: [] } },
    });
    renderApp('/admin/students/new');
    await userEvent.type(await screen.findByLabelText(/Full name/), 'Priya Nair');
    await userEvent.click(screen.getByRole('button', { name: 'Create student' }));
    expect(await screen.findByText('Student record created.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Priya Nair' })).toBeInTheDocument();
  });
});

describe('Course delete (FR-4)', () => {
  test('a course with associations reports that it was deactivated instead of deleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const course = { id: 1, code: 'UE24CS205', name: 'Software Engineering', credits: 4, status: 'ACTIVE', facultyId: 1, facultyName: 'Dr. Kavita Rao', enrolledCount: 2, components: [] };
    let deleted = false;
    mockApi({
      'GET /api/auth/session': { user: USERS.admin },
      'GET /api/courses/1': () => ({ course: { ...course, status: deleted ? 'INACTIVE' : 'ACTIVE' } }),
      'GET /api/courses/1/enrollments': { enrollments: [] },
      'DELETE /api/courses/1': () => {
        deleted = true;
        return { status: 409, body: { error: { code: 'COURSE_DEACTIVATED_INSTEAD', message: 'It has been deactivated instead.' } } };
      },
    });
    renderApp('/admin/courses/1');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('It has been deactivated instead.')).toBeInTheDocument();
    expect(await screen.findByText('Inactive')).toBeInTheDocument();
  });
});
