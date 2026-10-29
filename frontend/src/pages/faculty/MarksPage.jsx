import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, LoadError, Loading, PageHeader, useApi } from '../../components/ui';
import MarksTable from '../../components/MarksTable';

/**
 * Faculty marks entry / update for one assigned course (FR-9). Pick an assessment component,
 * type the marks obtained by each enrolled student (0 to the component maximum), save.
 */
export default function MarksPage() {
  const { id } = useParams();
  const sheet = useApi(() => api.courseMarks(id), [id]);
  const [componentId, setComponentId] = useState('');
  const [values, setValues] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);

  const components = sheet.data?.components || [];
  const component = components.find((c) => String(c.id) === String(componentId));

  useEffect(() => {
    if (!componentId && components.length) setComponentId(String(components[0].id));
  }, [components, componentId]);

  // Load saved marks for the selected component into the inputs.
  useEffect(() => {
    if (!sheet.data || !componentId) return;
    const next = {};
    for (const s of sheet.data.students) {
      const v = s.marks[componentId];
      next[s.studentId] = v === undefined || v === null ? '' : String(v);
    }
    setValues(next);
    setRowErrors({});
  }, [sheet.data, componentId]);

  async function save(e) {
    e.preventDefault();
    setMsg({ kind: '', text: '' });
    setRowErrors({});
    const entries = sheet.data.students
      .filter((s) => values[s.studentId] !== '' && values[s.studentId] !== undefined)
      .map((s) => ({ studentId: s.studentId, marksObtained: values[s.studentId] }));
    if (!entries.length) {
      setMsg({ kind: 'error', text: 'Enter marks for at least one student.' });
      return;
    }
    const alreadyEntered = sheet.data.enteredComponentIds.includes(Number(componentId));
    setBusy(true);
    try {
      const res = alreadyEntered
        ? await api.updateMarks(id, Number(componentId), entries)
        : await api.enterMarks(id, Number(componentId), entries);
      setMsg({ kind: 'success', text: `${res.message} ${component.name}: ${entries.length} student(s).` });
      sheet.setData(res);
    } catch (ex) {
      setMsg({ kind: 'error', text: ex.message });
      // Map "marks[i].marksObtained" back to the student row.
      const errs = {};
      for (const d of ex.details || []) {
        const m = /^marks\[(\d+)\]/.exec(d.field || '');
        if (m && entries[Number(m[1])]) errs[entries[Number(m[1])].studentId] = d.message;
      }
      setRowErrors(errs);
    } finally {
      setBusy(false);
    }
  }

  if (sheet.loading && !sheet.data) return <Loading />;
  if (sheet.error) {
    return (
      <>
        <PageHeader title="Marks" back={{ to: '/faculty', label: 'Dashboard' }} />
        <LoadError error={sheet.error} />
      </>
    );
  }
  const course = sheet.data.course;

  return (
    <>
      <PageHeader
        title={<>Marks · <span className="mono">{course.code}</span> {course.name}</>}
        subtitle="Choose an assessment component, enter marks for each student, then save. Leave a box empty to skip a student."
        back={{ to: '/faculty', label: 'Dashboard' }}
      />
      {components.length === 0 ? (
        <EmptyState>No assessment components are configured for this course. Ask the Administrator to add them.</EmptyState>
      ) : (
        <form className="card" onSubmit={save} aria-label="Enter marks">
          <div className="toolbar compact-toolbar">
            <div className="field inline">
              <label htmlFor="component">Assessment component</label>
              <select id="component" value={componentId} onChange={(e) => { setComponentId(e.target.value); setMsg({ kind: '', text: '' }); }}>
                {components.map((c) => <option key={c.id} value={c.id}>{c.name} (max {c.maxMarks})</option>)}
              </select>
            </div>
            {component && <span className="mode-pill new">Maximum: {component.maxMarks}</span>}
          </div>
          {sheet.data.students.length === 0 ? <EmptyState>No students are enrolled in this course.</EmptyState> : (
            <>
              <div className="table-wrap">
                <table className="compact">
                  <thead><tr><th>Roll number</th><th>Name</th><th>Marks obtained</th></tr></thead>
                  <tbody>
                    {sheet.data.students.map((s) => (
                      <tr key={s.studentId} className={rowErrors[s.studentId] ? 'row-error' : ''}>
                        <td className="mono">{s.rollNumber}</td>
                        <td>{s.name}</td>
                        <td>
                          <input
                            className="marks-input"
                            inputMode="decimal"
                            aria-label={`Marks for ${s.name}`}
                            value={values[s.studentId] ?? (s.marks?.[componentId] === undefined || s.marks?.[componentId] === null
                              ? ''
                              : String(s.marks?.[componentId]))}
                            onChange={(e) => setValues((v) => ({ ...v, [s.studentId]: e.target.value }))}
                            aria-invalid={Boolean(rowErrors[s.studentId])}
                          />
                          <span className="muted small"> / {component?.maxMarks}</span>
                          {rowErrors[s.studentId] && <div className="field-error">{rowErrors[s.studentId]}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Sticky so the Save button and its result stay visible on long class lists (NFR-3/NFR-4). */}
              <div className="form-actions sticky-actions">
                <Alert kind={msg.kind} onClose={() => setMsg({ kind: '', text: '' })}>{msg.text}</Alert>
                <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save marks'}</button>
              </div>
            </>
          )}
        </form>
      )}
      <section className="card">
        <h2>Marks sheet (all components)</h2>
        <MarksTable data={sheet.data} />
      </section>
    </>
  );
}
