import { EmptyState } from './ui';

/** Read-only course marks sheet: students x assessment components. */
export default function MarksTable({ data }) {
  if (!data.components.length) return <EmptyState>No assessment components are configured for this course.</EmptyState>;
  if (!data.students.length) return <EmptyState>No students are enrolled in this course.</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="compact grid-table">
        <thead>
          <tr>
            <th>Roll number</th>
            <th>Name</th>
            {data.components.map((c) => <th key={c.id} className="center">{c.name}<div className="muted small">/ {c.maxMarks}</div></th>)}
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.studentId}>
              <td className="mono">{s.rollNumber}</td>
              <td>{s.name}</td>
              {data.components.map((c) => (
                <td key={c.id} className="center">{s.marks[c.id] ?? <span className="muted">–</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
