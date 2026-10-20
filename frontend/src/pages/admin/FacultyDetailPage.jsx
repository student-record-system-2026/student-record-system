import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, LoadError, Loading, PageHeader, StatusBadge, useApi } from '../../components/ui';

/** View a faculty record, its assigned courses, and deactivate it (FR-3, FR-5 faculty-side view). */
export default function FacultyDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [flash, setFlash] = useState(location.state?.flash || '');
  const [err, setErr] = useState('');
  const { data, error, loading, setData } = useApi(() => api.getFaculty(id), [id]);

  async function deactivate() {
    if (!window.confirm('Deactivate this faculty member? The record is kept but cannot be assigned new courses.')) return;
    setErr('');
    try {
      const res = await api.deactivateFaculty(id);
      setData({ faculty: { ...data.faculty, ...res.faculty } });
      setFlash(res.message);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  const f = data.faculty;

  return (
    <>
      <PageHeader
        title={f.name}
        subtitle={<>Faculty record · {f.department} · <StatusBadge status={f.status} /></>}
        back={{ to: '/admin/faculty', label: 'Faculty' }}
        actions={
          <>
            <Link className="btn" to={`/admin/faculty/${id}/edit`}>Edit</Link>
            {f.status === 'ACTIVE' && <button className="btn btn-danger" type="button" onClick={deactivate}>Deactivate</button>}
          </>
        }
      />
      <Alert kind="success" onClose={() => setFlash('')}>{flash}</Alert>
      <Alert onClose={() => setErr('')}>{err}</Alert>
      <div className="grid-2">
        <section className="card">
          <h2>Details</h2>
          <dl className="details">
            <dt>Name</dt><dd>{f.name}</dd>
            <dt>Department</dt><dd>{f.department}</dd>
            <dt>Designation</dt><dd>{f.designation || '—'}</dd>
            <dt>Contact email</dt><dd>{f.email}</dd>
            <dt>Phone</dt><dd>{f.phone || '—'}</dd>
            <dt>Username</dt><dd className="mono">{f.username}</dd>
            <dt>Status</dt><dd><StatusBadge status={f.status} /></dd>
          </dl>
        </section>
        <section className="card">
          <h2>Assigned courses</h2>
          {f.assignedCourses.length === 0 ? (
            <EmptyState>No courses assigned.</EmptyState>
          ) : (
            <ul className="plain-list">
              {f.assignedCourses.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/courses/${c.id}`}><span className="mono">{c.code}</span> – {c.name}</Link>
                  <span className="muted small"> · {c.enrolledCount} student(s)</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="btn btn-small" to={`/admin/assignments?facultyId=${f.id}`}>Manage assignments</Link>
        </section>
      </div>
    </>
  );
}
