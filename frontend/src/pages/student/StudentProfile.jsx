import { api } from '../../api/client';
import { EmptyState, LoadError, Loading, PageHeader, formatDate, useApi } from '../../components/ui';

/** Student's own profile and currently enrolled courses (FR-11). */
export default function StudentProfile() {
  const { data, error, loading } = useApi(() => api.profile(), []);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  const p = data.profile;

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your personal and academic details." />
      <div className="grid-profile">
        <section className="card">
          <h2>Profile</h2>
          <dl className="details">
            <dt>Name</dt><dd>{p.name}</dd>
            <dt>Roll number</dt><dd className="mono">{p.rollNumber}</dd>
            <dt>Department</dt><dd>{p.department}</dd>
            <dt>Batch</dt><dd>{p.batch}</dd>
            <dt>Email</dt><dd>{p.email}</dd>
            <dt>Phone</dt><dd>{p.phone || '—'}</dd>
            <dt>Username</dt><dd className="mono">{p.username}</dd>
          </dl>
        </section>
        <section className="card">
          <h2>Enrolled courses</h2>
          {data.enrolledCourses.length === 0 ? <EmptyState>Not enrolled in any course.</EmptyState> : (
            <table className="compact">
              <thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Faculty</th><th>Enrolled</th></tr></thead>
              <tbody>
                {data.enrolledCourses.map((c) => (
                  <tr key={c.courseId}>
                    <td className="mono">{c.code}</td><td>{c.name}</td><td>{c.credits}</td>
                    <td>{c.facultyName || '—'}</td><td>{formatDate(c.enrolledAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
