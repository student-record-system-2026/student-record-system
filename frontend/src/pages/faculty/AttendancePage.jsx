import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, LoadError, Loading, PageHeader, Percent, formatDate, todayIso, useApi } from '../../components/ui';

/**
 * Faculty attendance recording / updating for one assigned course (FR-7; SADS Sequence Diagram 2).
 * Pick a session date, mark each enrolled student Present/Absent, save. Reopening a recorded
 * date loads the saved values for editing (PUT); a new date records a new session (POST).
 */
export default function AttendancePage() {
  const { id } = useParams();
  const [date, setDate] = useState(todayIso());
  const [marks, setMarks] = useState({});
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);
  const overview = useApi(() => api.courseAttendance(id), [id]);

  const sessions = overview.data?.sessions || [];
  const existing = sessions.find((s) => s.sessionDate === date);
  const roster = overview.data?.roster || [];

  // Load the statuses for the selected date (saved values, or "Present" by default for a new session).
  useEffect(() => {
    if (!overview.data) return;
    const next = {};
    for (const st of roster) next[st.studentId] = 'PRESENT';
    if (existing) for (const r of existing.records) next[r.studentId] = r.status;
    setMarks(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview.data, date]);

  const setAll = (status) => setMarks(Object.fromEntries(roster.map((s) => [s.studentId, status])));

  async function save(e) {
    e.preventDefault();
    setMsg({ kind: '', text: '' });
    setBusy(true);
    const records = roster.map((s) => ({ studentId: s.studentId, status: marks[s.studentId] || 'PRESENT' }));
    try {
      const res = existing
        ? await api.updateAttendance(id, date, records)
        : await api.recordAttendance(id, date, records);
      setMsg({ kind: 'success', text: `${res.message} (${formatDate(date)})` });
      overview.reload();
    } catch (ex) {
      setMsg({ kind: 'error', text: ex.message });
    } finally {
      setBusy(false);
    }
  }

  if (overview.loading && !overview.data) return <Loading />;
  if (overview.error) {
    return (
      <>
        <PageHeader title="Attendance" back={{ to: '/faculty', label: 'Dashboard' }} />
        <LoadError error={overview.error} />
      </>
    );
  }
  const course = overview.data.course;
  const present = Object.values(marks).filter((v) => v === 'PRESENT').length;

  return (
    <>
      <PageHeader
        title={<>Attendance · <span className="mono">{course.code}</span> {course.name}</>}
        subtitle="Choose a session date, mark each student, then save. Choose a date already recorded to edit it."
        back={{ to: '/faculty', label: 'Dashboard' }}
      />
      <div className="grid-att">
        <form className="card" onSubmit={save} aria-label="Record attendance">
          <div className="toolbar compact-toolbar">
            <div className="field inline">
              <label htmlFor="session-date">Session date</label>
              <input id="session-date" type="date" value={date} max={todayIso()} onChange={(e) => { setDate(e.target.value); setMsg({ kind: '', text: '' }); }} />
            </div>
            <span className={`mode-pill ${existing ? 'edit' : 'new'}`}>{existing ? 'Editing recorded session' : 'New session'}</span>
            <div className="spacer" />
            <button type="button" className="btn btn-small" onClick={() => setAll('PRESENT')}>All present</button>
            <button type="button" className="btn btn-small" onClick={() => setAll('ABSENT')}>All absent</button>
          </div>
          {roster.length === 0 ? (
            <EmptyState>No students are enrolled in this course.</EmptyState>
          ) : (
            <>
              <div className="table-wrap">
                <table className="compact">
                  <thead><tr><th>Roll number</th><th>Name</th><th className="center">Present</th><th className="center">Absent</th></tr></thead>
                  <tbody>
                    {roster.map((s) => (
                      <tr key={s.studentId} className={marks[s.studentId] === 'ABSENT' ? 'row-absent' : ''}>
                        <td className="mono">{s.rollNumber}</td>
                        <td>{s.name}</td>
                        {['PRESENT', 'ABSENT'].map((v) => (
                          <td key={v} className="center">
                            <input
                              type="radio"
                              name={`att-${s.studentId}`}
                              aria-label={`${s.name} ${v.toLowerCase()}`}
                              checked={marks[s.studentId] === v}
                              onChange={() => setMarks((m) => ({ ...m, [s.studentId]: v }))}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Sticky so the Save button and its result stay visible on long class lists (NFR-3/NFR-4). */}
              <div className="form-actions sticky-actions">
                {msg.text
                  ? <Alert kind={msg.kind} onClose={() => setMsg({ kind: '', text: '' })}>{msg.text}</Alert>
                  : <span className="muted">{present} present · {roster.length - present} absent</span>}
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : existing ? 'Update attendance' : 'Save attendance'}
                </button>
              </div>
            </>
          )}
        </form>
        <aside className="card">
          <h2>Recorded sessions</h2>
          {sessions.length === 0 ? <EmptyState>No sessions recorded yet.</EmptyState> : (
            <ul className="session-list">
              {sessions.map((s) => (
                <li key={s.sessionDate}>
                  <button type="button" className={`link-btn ${s.sessionDate === date ? 'current' : ''}`} onClick={() => setDate(s.sessionDate)}>
                    {formatDate(s.sessionDate)}
                  </button>
                  <span className="muted small">{s.present}/{s.present + s.absent} present</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mt">Class summary</h2>
          <div className="table-wrap scroll-y">
            <table className="compact">
              <thead><tr><th>Student</th><th className="center">%</th></tr></thead>
              <tbody>
                {overview.data.summary.map((s) => (
                  <tr key={s.studentId}><td>{s.name}</td><td className="center"><Percent value={s.percentage} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>
      </div>
    </>
  );
}
