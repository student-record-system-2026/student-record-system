import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { EmptyState, LoadError, Loading, PageHeader, useApi } from '../../components/ui';

/** Faculty profile, assigned courses and the students enrolled in each (FR-12). */
export default function FacultyProfile() {
  const { data, error, loading } = useApi(() => api.profile(), []);
  const [open, setOpen] = useState(null);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  const p = data.profile;

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your details, assigned courses and class lists." />
      <div className="grid-profile">
        <section className="card">
          <h2>Profile</h2>
          <dl className="details">
            <dt>Name</dt><dd>{p.name}</dd>
            <dt>Department</dt><dd>{p.department}</dd>
            <dt>Designation</dt><dd>{p.designation || '—'}</dd>
            <dt>Email</dt><dd>{p.email}</dd>
            <dt>Phone</dt><dd>{p.phone || '—'}</dd>
            <dt>Username</dt><dd className="mono">{p.username}</dd>
          </dl>
        </section>
        <section className="card">
          <h2>Assigned courses</h2>
          {data.assignedCourses.length === 0 && <EmptyState>No courses assigned.</EmptyState>}
          {data.assignedCourses.map((c) => (
            <div key={c.id} className="accordion">
              <button type="button" className="accordion-head" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span><span className="mono">{c.code}</span> – {c.name}</span>
                <span className="muted small">{c.students.length} student(s) {open === c.id ? '▲' : '▼'}</span>
              </button>
              {open === c.id && (
                <div className="accordion-body">
                  <div className="card-actions">
                    <Link className="btn btn-small" to={`/faculty/courses/${c.id}/attendance`}>Attendance</Link>
                    <Link className="btn btn-small" to={`/faculty/courses/${c.id}/marks`}>Marks</Link>
                  </div>
                  {c.students.length === 0 ? <EmptyState>No students enrolled.</EmptyState> : (
                    <div className="table-wrap scroll-y">
                      <table className="compact">
                        <thead><tr><th>Roll number</th><th>Name</th><th>Department</th><th>Batch</th></tr></thead>
                        <tbody>
                          {c.students.map((s) => (
                            <tr key={s.studentId}><td className="mono">{s.rollNumber}</td><td>{s.name}</td><td>{s.department}</td><td>{s.batch}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
