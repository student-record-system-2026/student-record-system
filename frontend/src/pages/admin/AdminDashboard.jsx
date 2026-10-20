import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { LoadError, Loading, PageHeader, StatCard, useApi } from '../../components/ui';

/** Administrator dashboard - record counts + quick links (FR-13, SRS 4.8.2). */
export default function AdminDashboard() {
  const { data, error, loading } = useApi(() => api.dashboard(), []);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  const { students, faculty, courses } = data.counts;

  return (
    <>
      <PageHeader title="Administrator Dashboard" subtitle="Institution-wide summary of academic records." />
      <section className="stats" aria-label="Record counts">
        <StatCard label="Students" value={students.total} sub={`${students.active} active`} to="/admin/students" />
        <StatCard label="Faculty" value={faculty.total} sub={`${faculty.active} active`} to="/admin/faculty" />
        <StatCard label="Courses" value={courses.total} sub={`${courses.active} active`} to="/admin/courses" />
      </section>
      <section className="card">
        <h2>Quick links</h2>
        <div className="quick-links">
          {data.links.map((l) => (
            <Link key={l.path} className="quick-link" to={l.path}>
              {l.label} →
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
