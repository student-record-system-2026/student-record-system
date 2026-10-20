import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { EmptyState, LoadError, Loading, PageHeader, StatCard, StatusBadge, useApi } from '../../components/ui';

/** Faculty dashboard - assigned courses and enrolled student counts with links (FR-13, SRS 4.8.2). */
export default function FacultyDashboard() {
  const { data, error, loading } = useApi(() => api.dashboard(), []);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;

  return (
    <>
      <PageHeader title={`Welcome, ${data.displayName}`} subtitle="Your assigned courses for this term." />
      <section className="stats">
        <StatCard label="Assigned courses" value={data.totals.courses} />
        <StatCard label="Enrolled students (total)" value={data.totals.students} />
        <StatCard label="My profile" value="→" sub="Details and class lists" to="/faculty/profile" />
      </section>
      {data.assignedCourses.length === 0 ? (
        <EmptyState>No courses are assigned to you yet. Please contact the Administrator.</EmptyState>
      ) : (
        <section className="course-grid" aria-label="Assigned courses">
          {data.assignedCourses.map((c) => (
            <article key={c.id} className="card course-card">
              <div className="course-code mono">{c.code}</div>
              <h2>{c.name}</h2>
              <p className="muted">{c.credits} credits · {c.enrolledCount} student(s) enrolled · <StatusBadge status={c.status} /></p>
              <div className="card-actions">
                {c.links.map((l) => (
                  <Link key={l.path} className="btn btn-small btn-primary" to={l.path}>{l.label}</Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
