import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, LoadError, Loading, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { useForm } from '../../components/useForm';

const EMPTY = { name: '', rollNumber: '', department: '', batch: '', email: '', phone: '', username: '', password: '', status: 'ACTIVE' };

/** Create / edit a student record (FR-2). Creating a student also provisions their login (SRS 2.7). */
export default function StudentFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const form = useForm(EMPTY);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api.getStudent(id)
      .then(({ student }) => form.setValues({ ...EMPTY, ...student, phone: student.phone || '' }))
      .catch(setLoadError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(e) {
    e.preventDefault();
    const res = await form.submit((v) => {
      const body = { name: v.name, rollNumber: v.rollNumber, department: v.department, batch: v.batch, email: v.email, phone: v.phone };
      if (editing) return api.updateStudent(id, { ...body, status: v.status });
      return api.createStudent({ ...body, username: v.username, password: v.password });
    });
    if (res) navigate(`/admin/students/${res.student.id}`, { state: { flash: res.message } });
  }

  if (loading) return <Loading />;
  if (loadError) return <LoadError error={loadError} />;
  const { values, set, errors } = form;

  return (
    <>
      <PageHeader
        title={editing ? `Edit student – ${values.name}` : 'New student'}
        back={{ to: editing ? `/admin/students/${id}` : '/admin/students', label: editing ? 'Student record' : 'Students' }}
      />
      <form className="card form-card" onSubmit={onSubmit} noValidate aria-label="Student form">
        <Alert onClose={() => form.setMessage('')}>{form.message}</Alert>
        <h2 className="form-section">Personal &amp; academic details</h2>
        <div className="grid-2">
          <TextInput label="Full name" name="name" value={values.name} onChange={set} error={errors.name} required />
          <TextInput label="Roll number" name="rollNumber" value={values.rollNumber} onChange={set} error={errors.rollNumber} required hint="Letters and digits only, e.g. PES1UG24CS099" />
          <TextInput label="Department" name="department" value={values.department} onChange={set} error={errors.department} required hint="e.g. CSE" />
          <TextInput label="Batch" name="batch" value={values.batch} onChange={set} error={errors.batch} required hint="Year of admission, e.g. 2024" inputMode="numeric" />
          <TextInput label="Contact email" name="email" type="email" value={values.email} onChange={set} error={errors.email} required />
          <TextInput label="Phone" name="phone" value={values.phone} onChange={set} error={errors.phone} hint="Optional" />
          {editing && (
            <SelectInput
              label="Status" name="status" value={values.status} onChange={set} error={errors.status}
              options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
              hint="Inactive students are kept but cannot be enrolled in courses."
            />
          )}
        </div>
        {!editing && (
          <>
            <h2 className="form-section">Login account</h2>
            <div className="grid-2">
              <TextInput label="Username" name="username" value={values.username} onChange={set} error={errors.username} hint="Optional – defaults to the roll number" autoComplete="off" />
              <TextInput label="Initial password" name="password" type="password" value={values.password} onChange={set} error={errors.password} required hint="At least 8 characters with a letter and a digit" autoComplete="new-password" />
            </div>
          </>
        )}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={form.busy}>
            {form.busy ? 'Saving…' : editing ? 'Save changes' : 'Create student'}
          </button>
        </div>
      </form>
    </>
  );
}
