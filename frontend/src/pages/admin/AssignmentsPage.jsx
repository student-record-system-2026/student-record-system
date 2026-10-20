import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, LoadError, Loading, PageHeader, StatusBadge, useApi } from '../../components/ui';

/**
 * Faculty-Course Assignment (FR-5): select a faculty member and one or more courses and assign
 * them; view, change or remove existing assignments. Each course has one faculty member (SRS 2.7).
 */
export default function AssignmentsPage() {
  const [params] = useSearchParams();
  const highlightCourse = Number(params.get('courseId')) || null;
  const [facultyId, setFacultyId] = useState(params.get('facultyId') || '');
  const [selected, setSelected] = useState(highlightCourse ? [highlightCourse] : []);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const faculty = useApi(() => api.listFaculty(), []);
  const courses = useApi(() => api.listCourses(), []);

  const activeFaculty = useMemo(
    () => (faculty.data ? faculty.data.faculty.filter((f) => f.status === 'ACTIVE') : []),
    [faculty.data]
  );

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function assignSelected(e) {
    e.preventDefault();
    setErr('');
    setResults([]);
    if (!facultyId) return setErr('Select a faculty member.');
    if (!selected.length) return setErr('Select at least one course.');
    const fid = Number(facultyId);
    const byId = new Map(courses.data.courses.map((c) => [c.id, c]));
    const reassigning = selected.filter((id) => byId.get(id).facultyId && byId.get(id).facultyId !== fid);
    if (reassigning.length && !window.confirm(
      `${reassigning.map((id) => byId.get(id).code).join(', ')} already ha${reassigning.length > 1 ? 've' : 's'} a faculty member. Reassign to the selected faculty?`
    )) return;

    setBusy(true);
    const out = [];
    for (const id of selected) {
      const c = byId.get(id);
      try {
        if (c.facultyId === fid) out.push({ code: c.code, ok: true, msg: 'Already assigned.' });
        else if (c.facultyId) { await api.reassignFaculty(id, fid); out.push({ code: c.code, ok: true, msg: 'Reassigned.' }); }
        else { await api.assignFaculty(id, fid); out.push({ code: c.code, ok: true, msg: 'Assigned.' }); }
      } catch (ex) {
        out.push({ code: c.code, ok: false, msg: ex.message });
      }
    }
    setResults(out);
    setSelected([]);
    setBusy(false);
    courses.reload();
  }

  async function changeAssignment(course, newFacultyId) {
    setErr('');
    setResults([]);
    try {
      if (!newFacultyId) {
        if (!window.confirm(`Remove the faculty assignment from ${course.code}?`)) return;
        await api.removeAssignment(course.id);
        setResults([{ code: course.code, ok: true, msg: 'Assignment removed.' }]);
      } else if (course.facultyId) {
        await api.reassignFaculty(course.id, Number(newFacultyId));
        setResults([{ code: course.code, ok: true, msg: 'Reassigned.' }]);
      } else {
        await api.assignFaculty(course.id, Number(newFacultyId));
        setResults([{ code: course.code, ok: true, msg: 'Assigned.' }]);
      }
    } catch (ex) {
      setResults([{ code: course.code, ok: false, msg: ex.message }]);
    }
    courses.reload();
  }

  if (faculty.loading || courses.loading) return <Loading />;
  if (faculty.error || courses.error) return <LoadError error={faculty.error || courses.error} />;
  const activeCourses = courses.data.courses.filter((c) => c.status === 'ACTIVE');

  return (
    <>
      <PageHeader title="Faculty-Course Assignment" subtitle="Assign one or more courses to a faculty member, or change existing assignments." />
      <Alert onClose={() => setErr('')}>{err}</Alert>
      {results.length > 0 && (
        <div className="results" role="status">
          {results.map((r) => (
            <div key={r.code} className={r.ok ? 'res-ok' : 'res-bad'}><span className="mono">{r.code}</span>: {r.msg}</div>
          ))}
        </div>
      )}

      <form className="card" onSubmit={assignSelected} aria-label="Assign courses to faculty">
        <h2>Assign courses to a faculty member</h2>
        <div className="field">
          <label htmlFor="assign-faculty">Faculty member</label>
          <select id="assign-faculty" value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
            <option value="">Select active faculty…</option>
            {activeFaculty.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.department})</option>)}
          </select>
          <div className="hint">Inactive faculty are not listed – they cannot receive new assignments.</div>
        </div>
        <fieldset className="checklist">
          <legend>Courses (active only)</legend>
          {activeCourses.map((c) => (
            <label key={c.id} className={`check-item ${highlightCourse === c.id ? 'highlight' : ''}`}>
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
              <span className="mono">{c.code}</span> {c.name}
              <span className="muted small"> – {c.facultyName ? `currently ${c.facultyName}` : 'unassigned'}</span>
            </label>
          ))}
        </fieldset>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Assign selected courses'}</button>
        </div>
      </form>

      <section className="card table-card">
        <h2>Current assignments</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Course</th><th>Status</th><th>Assigned faculty</th><th>Change</th></tr></thead>
            <tbody>
              {courses.data.courses.map((c) => (
                <tr key={c.id} className={highlightCourse === c.id ? 'highlight' : ''}>
                  <td><Link to={`/admin/courses/${c.id}`}><span className="mono">{c.code}</span> {c.name}</Link></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.facultyName || <span className="muted">Unassigned</span>}</td>
                  <td>
                    <select
                      aria-label={`Change faculty for ${c.code}`}
                      value={c.facultyId || ''}
                      onChange={(e) => changeAssignment(c, e.target.value)}
                    >
                      <option value="">{c.facultyId ? '— Remove assignment —' : '— Unassigned —'}</option>
                      {activeFaculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      {c.facultyId && !activeFaculty.some((f) => f.id === c.facultyId) && (
                        <option value={c.facultyId} disabled>{c.facultyName} (inactive)</option>
                      )}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
