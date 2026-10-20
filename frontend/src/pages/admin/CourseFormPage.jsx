import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, LoadError, Loading, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { useForm } from '../../components/useForm';

// Starting suggestion from SRS 2.7 ("e.g. Internal Assessment 1, Internal Assessment 2, Assignment");
// the Administrator can change or remove these (SRS TBD-2: configured per course).
const DEFAULT_COMPONENTS = [
  { name: 'Internal Assessment 1', maxMarks: '20' },
  { name: 'Internal Assessment 2', maxMarks: '20' },
  { name: 'Assignment', maxMarks: '10' },
];

/** Create / edit a course and configure its assessment components (FR-4; SADS 4.6). */
export default function CourseFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const form = useForm({ code: '', name: '', credits: '', status: 'ACTIVE' });
  const [components, setComponents] = useState(editing ? [] : DEFAULT_COMPONENTS);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api.getCourse(id)
      .then(({ course }) => {
        form.setValues({ code: course.code, name: course.name, credits: String(course.credits), status: course.status });
        setComponents(course.components.map((c) => ({ id: c.id, name: c.name, maxMarks: String(c.maxMarks) })));
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setComp = (i, key, value) => setComponents((cs) => cs.map((c, j) => (j === i ? { ...c, [key]: value } : c)));
  const addComp = () => setComponents((cs) => [...cs, { name: '', maxMarks: '' }]);
  const removeComp = (i) => setComponents((cs) => cs.filter((_, j) => j !== i));

  async function onSubmit(e) {
    e.preventDefault();
    const res = await form.submit((v) => {
      const body = {
        code: v.code, name: v.name, credits: v.credits,
        components: components.map((c) => ({ ...(c.id ? { id: c.id } : {}), name: c.name, maxMarks: c.maxMarks })),
      };
      return editing ? api.updateCourse(id, { ...body, status: v.status }) : api.createCourse(body);
    });
    if (res) navigate(`/admin/courses/${res.course.id}`, { state: { flash: res.message } });
  }

  if (loading) return <Loading />;
  if (loadError) return <LoadError error={loadError} />;
  const { values, set, errors } = form;

  return (
    <>
      <PageHeader
        title={editing ? `Edit course – ${values.code}` : 'New course'}
        back={{ to: editing ? `/admin/courses/${id}` : '/admin/courses', label: editing ? 'Course' : 'Courses' }}
      />
      <form className="card form-card" onSubmit={onSubmit} noValidate aria-label="Course form">
        <Alert onClose={() => form.setMessage('')}>{form.message}</Alert>
        <h2 className="form-section">Course details</h2>
        <div className="grid-3">
          <TextInput label="Course code" name="code" value={values.code} onChange={set} error={errors.code} required hint="e.g. UE24CS301" />
          <TextInput label="Course name" name="name" value={values.name} onChange={set} error={errors.name} required />
          <TextInput label="Credits" name="credits" value={values.credits} onChange={set} error={errors.credits} required hint="Whole number, 1–10" inputMode="numeric" />
          {editing && (
            <SelectInput
              label="Status" name="status" value={values.status} onChange={set} error={errors.status}
              options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
              hint="Inactive courses accept no new assignments or enrollments."
            />
          )}
        </div>

        <h2 className="form-section">Assessment components</h2>
        <p className="hint">Faculty enter marks against these components. Each needs a name and a maximum mark.</p>
        {errors.components && <div className="field-error">{errors.components}</div>}
        <div className="components-editor">
          {components.map((c, i) => {
            const nameErr = errors[`components[${i}].name`];
            const maxErr = errors[`components[${i}].maxMarks`];
            return (
              <div className="component-row" key={c.id || `new-${i}`}>
                <div className={`field ${nameErr ? 'has-error' : ''}`}>
                  <label htmlFor={`comp-name-${i}`}>Component name</label>
                  <input id={`comp-name-${i}`} value={c.name} onChange={(e) => setComp(i, 'name', e.target.value)} />
                  {nameErr && <div className="field-error">{nameErr}</div>}
                </div>
                <div className={`field narrow-field ${maxErr ? 'has-error' : ''}`}>
                  <label htmlFor={`comp-max-${i}`}>Maximum marks</label>
                  <input id={`comp-max-${i}`} inputMode="decimal" value={c.maxMarks} onChange={(e) => setComp(i, 'maxMarks', e.target.value)} />
                  {maxErr && <div className="field-error">{maxErr}</div>}
                </div>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => removeComp(i)} aria-label={`Remove component ${c.name || i + 1}`}>
                  Remove
                </button>
              </div>
            );
          })}
          <button type="button" className="btn btn-small" onClick={addComp}>+ Add component</button>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={form.busy}>
            {form.busy ? 'Saving…' : editing ? 'Save changes' : 'Create course'}
          </button>
        </div>
      </form>
    </>
  );
}
