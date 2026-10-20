import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, LoadError, Loading, PageHeader, StatusBadge, useApi } from '../../components/ui';

/** Manage Students - list / search (FR-2). */
export default function StudentsPage() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState({ search: '', status: '' });
  const { data, error, loading } = useApi(() => api.listStudents(query), [query.search, query.status]);

  function apply(e) {
    e.preventDefault();
    setQuery({ search: search.trim(), status });
  }

  return (
    <>
      <PageHeader
        title="Manage Students"
        subtitle="Create, view, update and deactivate student records."
        actions={<Link className="btn btn-primary" to="/admin/students/new">+ New student</Link>}
      />
      {location.state?.flash && <Alert kind="success">{location.state.flash}</Alert>}
      <form className="toolbar" onSubmit={apply} role="search">
        <input
          aria-label="Search students"
          placeholder="Search by name, roll number, email, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          <div className="table-meta">{data.students.length} record(s)</div>
          {data.students.length === 0 ? (
            <EmptyState>No students match your search.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Roll number</th><th>Name</th><th>Department</th><th>Batch</th><th>Contact</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.rollNumber}</td>
                      <td>{s.name}</td>
                      <td>{s.department}</td>
                      <td>{s.batch}</td>
                      <td>{s.email}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td className="row-actions">
                        <Link to={`/admin/students/${s.id}`}>View</Link>
                        <Link to={`/admin/students/${s.id}/edit`}>Edit</Link>
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
