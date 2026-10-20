import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, LoadError, Loading, PageHeader, StatusBadge, useApi } from '../../components/ui';

/** Manage Courses - list / search (FR-4). */
export default function CoursesPage() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState({ search: '', status: '' });
  const { data, error, loading } = useApi(() => api.listCourses(query), [query.search, query.status]);

  return (
    <>
      <PageHeader
        title="Manage Courses"
        subtitle="Course catalogue with assessment components, faculty assignment and enrollment counts."
        actions={<Link className="btn btn-primary" to="/admin/courses/new">+ New course</Link>}
      />
      {location.state?.flash && <Alert kind="success">{location.state.flash}</Alert>}
      <form className="toolbar" role="search" onSubmit={(e) => { e.preventDefault(); setQuery({ search: search.trim(), status }); }}>
        <input aria-label="Search courses" placeholder="Search by course code or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button className="btn" type="submit">Search</button>
      </form>
      {loading && <Loading />}
      <LoadError error={error} />
      {data && (
        <div className="card table-card">
          <div className="table-meta">{data.courses.length} course(s)</div>
          {data.courses.length === 0 ? (
            <EmptyState>No courses match your search.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Credits</th><th>Faculty</th><th>Enrolled</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {data.courses.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{c.code}</td>
                      <td>{c.name}</td>
                      <td>{c.credits}</td>
                      <td>{c.facultyName || <span className="muted">Unassigned</span>}</td>
                      <td>{c.enrolledCount}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="row-actions">
                        <Link to={`/admin/courses/${c.id}`}>View</Link>
                        <Link to={`/admin/courses/${c.id}/edit`}>Edit</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
