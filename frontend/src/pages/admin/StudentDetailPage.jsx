import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, LoadError, Loading, PageHeader, StatusBadge, formatDate, useApi } from '../../components/ui';

/** View a student record, its enrollments, and deactivate it (FR-2, FR-6 student-side view). */
export default function StudentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [flash, setFlash] = useState(location.state?.flash || '');
  const [err, setErr] = useState('');
  const { data, error, loading, setData } = useApi(() => api.getStudent(id), [id]);

  async function deactivate() {
    if (!window.confirm('Deactivate this student? The record is kept but the student cannot be enrolled in new courses.')) return;
    setErr('');
    try {
      const res = await api.deactivateStudent(id);
      setData({ student: { ...data.student, ...res.student } });
      setFlash(res.message);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  const s = data.student;

  return (
    <>
      <PageHeader
        title={s.name}
        subtitle={<>Student record · <span className="mono">{s.rollNumber}</span> · <StatusBadge status={s.status} /></>}
        back={{ to: '/admin/students', label: 'Students' }}
        actions={
          <>
            <Link className="btn" to={`/admin/students/${id}/edit`}>Edit</Link>
            {s.status === 'ACTIVE' && <button className="btn btn-danger" type="button" onClick={deactivate}>Deactivate</button>}
          </>
        }
      />
      <Alert kind="success" onClose={() => setFlash('')}>{flash}</Alert>
      <Alert onClose={() => setErr('')}>{err}</Alert>
      <div className="grid-2">
        <section className="card">
          <h2>Details</h2>
          <dl className="details">
            <dt>Name</dt><dd>{s.name}</dd>
            <dt>Roll number</dt><dd className="mono">{s.rollNumber}</dd>
            <dt>Department</dt><dd>{s.department}</dd>
            <dt>Batch</dt><dd>{s.batch}</dd>
            <dt>Contact email</dt><dd>{s.email}</dd>
            <dt>Phone</dt><dd>{s.phone || '—'}</dd>
            <dt>Username</dt><dd className="mono">{s.username}</dd>
            <dt>Status</dt><dd><StatusBadge status={s.status} /></dd>
          </dl>
        </section>
        <section className="card">
          <h2>Enrolled courses</h2>
          {s.enrollments.length === 0 ? (
            <EmptyState>Not enrolled in any course.</EmptyState>
          ) : (
            <ul className="plain-list">
              {s.enrollments.map((e) => (
                <li key={e.courseId}>
                  <Link to={`/admin/courses/${e.courseId}`}><span className="mono">{e.code}</span> – {e.name}</Link>
                  <span className="muted small"> · {e.facultyName || 'No faculty assigned'} · since {formatDate(e.enrolledAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link className="btn btn-small" to={`/admin/enrollments?studentId=${s.id}`}>Manage enrollments</Link>
        </section>
      </div>
    </>
  );
}
