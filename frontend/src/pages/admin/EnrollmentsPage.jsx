import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, LoadError, Loading, PageHeader, useApi } from '../../components/ui';

/**
 * Student-Course Enrollment (FR-6): select a student and one or more courses to enroll them in,
 * or pick a course and enroll several students; view and remove existing enrollments.
 * Inactive students and inactive courses are excluded from new enrollment (FR-2, FR-4).
 */
export default function EnrollmentsPage() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('courseId') ? 'course' : 'student');
  const students = useApi(() => api.listStudents({ status: 'ACTIVE' }), []);
  const courses = useApi(() => api.listCourses(), []);

  if (students.loading || courses.loading) return <Loading />;
  if (students.error || courses.error) return <LoadError error={students.error || courses.error} />;

  return (
    <>
      <PageHeader title="Student Enrollment" subtitle="Enroll students in courses and manage existing enrollments." />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'student'} className={mode === 'student' ? 'active' : ''} onClick={() => setMode('student')}>By student</button>
        <button type="button" role="tab" aria-selected={mode === 'course'} className={mode === 'course' ? 'active' : ''} onClick={() => setMode('course')}>By course</button>
      </div>
      {mode === 'student' ? (
        <ByStudent students={students.data.students} courses={courses.data.courses} initial={params.get('studentId') || ''} onChange={courses.reload} />
      ) : (
        <ByCourse students={students.data.students} courses={courses.data.courses} initial={params.get('courseId') || ''} onChange={courses.reload} />
      )}
    </>
  );
}

function Results({ items }) {
  if (!items.length) return null;
  return (
    <div className="results" role="status">
      {items.map((r, i) => <div key={i} className={r.ok ? 'res-ok' : 'res-bad'}>{r.label}: {r.msg}</div>)}
    </div>
  );
}

function StudentPicker({ students, value, onChange, id }) {
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f ? students.filter((s) => `${s.rollNumber} ${s.name}`.toLowerCase().includes(f)) : students;
    return list.slice(0, 300);
  }, [students, filter]);
  return (
    <div className="picker">
      <input aria-label="Filter students" placeholder="Type to filter by roll number or name…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} size={6}>
        {shown.map((s) => <option key={s.id} value={s.id}>{s.rollNumber} – {s.name}</option>)}
      </select>
    </div>
  );
}

function ByStudent({ students, courses, initial, onChange }) {
  const [studentId, setStudentId] = useState(initial);
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const detail = useApi(() => (studentId ? api.getStudent(studentId) : Promise.resolve(null)), [studentId]);
  const enrolledIds = new Set((detail.data?.student.enrollments || []).map((e) => e.courseId));
  const available = courses.filter((c) => c.status === 'ACTIVE' && !enrolledIds.has(c.id));

  async function enroll(e) {
    e.preventDefault();
    setResults([]);
    if (!studentId) return setResults([{ ok: false, label: 'Student', msg: 'Select a student.' }]);
    if (!selected.length) return setResults([{ ok: false, label: 'Courses', msg: 'Select at least one course.' }]);
    setBusy(true);
    const out = [];
    for (const cid of selected) {
      const c = courses.find((x) => x.id === cid);
      try {
        await api.enrollStudent(cid, Number(studentId));
        out.push({ ok: true, label: c.code, msg: 'Enrolled.' });
      } catch (ex) {
        out.push({ ok: false, label: c.code, msg: ex.message });
      }
    }
    setResults(out);
    setSelected([]);
    setBusy(false);
    detail.reload();
    onChange();
  }

  async function remove(courseId, code) {
    if (!window.confirm(`Remove this student from ${code}? Past attendance and marks are kept.`)) return;
    try {
      await api.removeEnrollment(courseId, Number(studentId));
      setResults([{ ok: true, label: code, msg: 'Enrollment removed.' }]);
    } catch (ex) {
      setResults([{ ok: false, label: code, msg: ex.message }]);
    }
    detail.reload();
    onChange();
  }

  return (
    <div className="grid-2">
      <form className="card" onSubmit={enroll} aria-label="Enroll student in courses">
        <h2>Enroll a student</h2>
        <div className="field">
          <label htmlFor="enroll-student">Student (active only)</label>
          <StudentPicker id="enroll-student" students={students} value={studentId} onChange={(v) => { setStudentId(v); setSelected([]); setResults([]); }} />
        </div>
        {studentId && (
          <fieldset className="checklist">
            <legend>Courses to enroll in</legend>
            {available.length === 0 && <EmptyState>No further active courses available.</EmptyState>}
            {available.map((c) => (
              <label key={c.id} className="check-item">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} />
                <span className="mono">{c.code}</span> {c.name}
              </label>
            ))}
          </fieldset>
        )}
        <Results items={results} />
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Enroll in selected courses'}</button>
        </div>
      </form>
      <section className="card">
        <h2>Current enrollments</h2>
        {!studentId && <EmptyState>Select a student to see their enrollments.</EmptyState>}
        {detail.loading && studentId && <Loading />}
        {detail.data && (
          <>
            <p><Link to={`/admin/students/${studentId}`}>{detail.data.student.name}</Link> <span className="mono muted">{detail.data.student.rollNumber}</span></p>
            {detail.data.student.enrollments.length === 0 ? <EmptyState>Not enrolled in any course.</EmptyState> : (
              <table className="compact">
                <thead><tr><th>Course</th><th>Faculty</th><th /></tr></thead>
                <tbody>
                  {detail.data.student.enrollments.map((e) => (
                    <tr key={e.courseId}>
                      <td><span className="mono">{e.code}</span> {e.name}</td>
                      <td>{e.facultyName || '—'}</td>
                      <td className="row-actions"><button type="button" className="link-btn danger" onClick={() => remove(e.courseId, e.code)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ByCourse({ students, courses, initial, onChange }) {
  const activeCourses = courses.filter((c) => c.status === 'ACTIVE');
  const [courseId, setCourseId] = useState(initial);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const roster = useApi(() => (courseId ? api.listEnrollments(courseId) : Promise.resolve(null)), [courseId]);
  const enrolled = new Set((roster.data?.enrollments || []).map((e) => e.studentId));
  const f = filter.trim().toLowerCase();
  const candidates = students
    .filter((s) => !enrolled.has(s.id))
    .filter((s) => !f || `${s.rollNumber} ${s.name}`.toLowerCase().includes(f));

  async function enroll(e) {
    e.preventDefault();
    setResults([]);
    if (!courseId) return setResults([{ ok: false, label: 'Course', msg: 'Select a course.' }]);
    if (!selected.length) return setResults([{ ok: false, label: 'Students', msg: 'Select at least one student.' }]);
    setBusy(true);
    const out = [];
    for (const sid of selected) {
      const s = students.find((x) => x.id === sid);
      try {
        await api.enrollStudent(Number(courseId), sid);
        out.push({ ok: true, label: s.rollNumber, msg: 'Enrolled.' });
      } catch (ex) {
        out.push({ ok: false, label: s.rollNumber, msg: ex.message });
      }
    }
    setResults(out);
    setSelected([]);
    setBusy(false);
    roster.reload();
    onChange();
  }

  return (
    <form className="card" onSubmit={enroll} aria-label="Enroll students in a course">
      <h2>Enroll students in a course</h2>
      <div className="field">
        <label htmlFor="enroll-course">Course (active only)</label>
        <select id="enroll-course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setSelected([]); setResults([]); }}>
          <option value="">Select a course…</option>
          {activeCourses.map((c) => <option key={c.id} value={c.id}>{c.code} – {c.name} ({c.enrolledCount} enrolled)</option>)}
        </select>
      </div>
      {courseId && (
        <>
          <div className="field">
            <label htmlFor="cand-filter">Students not yet enrolled ({candidates.length})</label>
            <input id="cand-filter" placeholder="Filter by roll number or name…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <fieldset className="checklist scroll-y">
            <legend className="sr-only">Students</legend>
            {candidates.slice(0, 300).map((s) => (
              <label key={s.id} className="check-item">
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => setSelected((x) => (x.includes(s.id) ? x.filter((y) => y !== s.id) : [...x, s.id]))} />
                <span className="mono">{s.rollNumber}</span> {s.name}
              </label>
            ))}
          </fieldset>
          <p className="muted small">To view or remove current enrollments, open the <Link to={`/admin/courses/${courseId}`}>course page</Link>.</p>
        </>
      )}
      <Results items={results} />
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : `Enroll ${selected.length || ''} selected student(s)`}</button>
      </div>
    </form>
  );
}
