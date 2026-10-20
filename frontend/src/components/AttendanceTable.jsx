import { EmptyState, Percent, formatDate } from './ui';

/** Read-only course attendance grid: students x sessions, with per-student percentage. */
export default function AttendanceTable({ data }) {
  if (!data.roster.length) return <EmptyState>No students are enrolled in this course.</EmptyState>;
  if (!data.sessions.length) return <EmptyState>No attendance sessions have been recorded yet.</EmptyState>;
  const sessions = [...data.sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const lookup = new Map();
  for (const s of sessions) for (const r of s.records) lookup.set(`${r.studentId}|${s.sessionDate}`, r.status);
  const summary = new Map(data.summary.map((s) => [s.studentId, s]));

  return (
    <div className="table-wrap">
      <table className="compact grid-table">
        <thead>
          <tr>
            <th>Roll number</th>
            <th>Name</th>
            {sessions.map((s) => <th key={s.sessionDate} className="center">{formatDate(s.sessionDate)}</th>)}
            <th className="center">Attended</th>
            <th className="center">%</th>
          </tr>
        </thead>
        <tbody>
          {data.roster.map((st) => {
            const sum = summary.get(st.studentId);
            return (
              <tr key={st.studentId}>
                <td className="mono">{st.rollNumber}</td>
                <td>{st.name}</td>
                {sessions.map((s) => {
                  const v = lookup.get(`${st.studentId}|${s.sessionDate}`);
                  return (
                    <td key={s.sessionDate} className={`center att ${v === 'PRESENT' ? 'att-p' : v === 'ABSENT' ? 'att-a' : ''}`}>
                      {v === 'PRESENT' ? 'P' : v === 'ABSENT' ? 'A' : '–'}
                    </td>
                  );
                })}
                <td className="center">{sum ? `${sum.present}/${sum.total}` : '–'}</td>
                <td className="center"><Percent value={sum ? sum.percentage : null} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
