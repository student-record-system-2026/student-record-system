import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { EmptyState, LoadError, Loading, PageHeader, StatusBadge, useApi } from '../../components/ui';

/** Manage Faculty - list / search (FR-3). */
export default function FacultyPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState({ search: '', status: '' });
  const { data, error, loading } = useApi(() => api.listFaculty(query), [query.search, query.status]);

  return (
    <>
      <PageHeader
        title="Manage Faculty"
        subtitle="Create, view, update and deactivate faculty records."
        actions={<Link className="btn btn-primary" to="/admin/faculty/new">+ New faculty</Link>}
      />
      <form className="toolbar" role="search" onSubmit={(e) => { e.preventDefault(); setQuery({ search: search.trim(), status }); }}>
        <input aria-label="Search faculty" placeholder="Search by name, email, department…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <div className="table-meta">{data.faculty.length} record(s)</div>
          {data.faculty.length === 0 ? (
            <EmptyState>No faculty match your search.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Department</th><th>Designation</th><th>Contact</th><th>Username</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {data.faculty.map((f) => (
                    <tr key={f.id}>
                      <td>{f.name}</td>
                      <td>{f.department}</td>
                      <td>{f.designation || '—'}</td>
                      <td>{f.email}</td>
                      <td className="mono">{f.username}</td>
                      <td><StatusBadge status={f.status} /></td>
                      <td className="row-actions">
                        <Link to={`/admin/faculty/${f.id}`}>View</Link>
                        <Link to={`/admin/faculty/${f.id}/edit`}>Edit</Link>
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
