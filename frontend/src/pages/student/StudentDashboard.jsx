import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { EmptyState, LoadError, Loading, PageHeader, Percent, useApi } from '../../components/ui';

/** Student dashboard - enrolled courses with attendance and marks summary + links (FR-13, SRS 4.8.2). */
export default function StudentDashboard() {
  const { data, error, loading } = useApi(() => api.dashboard(), []);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;

  return (
    <>
      <PageHeader title={`Welcome, ${data.displayName}`} subtitle="A summary of your enrolled courses." />
      <div className="quick-links inline-links">
        {data.links.map((l) => <Link key={l.path} className="btn" to={l.path}>{l.label}</Link>)}
      </div>
      {data.enrolledCourses.length === 0 ? (
        <EmptyState>You are not enrolled in any course yet.</EmptyState>
      ) : (
        <section className="course-grid" aria-label="Enrolled courses">
          {data.enrolledCourses.map((c) => (
            <article key={c.courseId} className="card course-card">
              <div className="course-code mono">{c.code}</div>
              <h2>{c.name}</h2>
              <p className="muted small">{c.facultyName ? `Faculty: ${c.facultyName}` : 'Faculty not yet assigned'}</p>
              <dl className="mini-stats">
                <div>
                  <dt>Attendance</dt>
                  <dd><Percent value={c.attendance.percentage} /> <span className="muted small">({c.attendance.present}/{c.attendance.total})</span></dd>
                </div>
                <div>
                  <dt>Marks entered</dt>
                  <dd>
                    {c.marks.enteredCount}/{c.marks.componentCount} components
                    {c.marks.enteredCount > 0 && <span className="muted small"> · {c.marks.totalObtained}/{c.marks.totalMaxEntered}</span>}
                  </dd>
                </div>
              </dl>
              <div className="card-actions">
                <Link className="btn btn-small" to={`/student/attendance?courseId=${c.courseId}`}>Attendance details</Link>
                <Link className="btn btn-small" to={`/student/marks?courseId=${c.courseId}`}>Marks details</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
