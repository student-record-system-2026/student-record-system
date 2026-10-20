import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, LoadError, Loading, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { useForm } from '../../components/useForm';

const EMPTY = { name: '', department: '', designation: '', email: '', phone: '', username: '', password: '', status: 'ACTIVE' };

/** Create / edit a faculty record (FR-3). Creating a faculty member also provisions their login (SRS 2.7). */
export default function FacultyFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const form = useForm(EMPTY);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api.getFaculty(id)
      .then(({ faculty }) => form.setValues({ ...EMPTY, ...faculty, phone: faculty.phone || '', designation: faculty.designation || '' }))
      .catch(setLoadError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(e) {
    e.preventDefault();
    const res = await form.submit((v) => {
      const body = { name: v.name, department: v.department, designation: v.designation, email: v.email, phone: v.phone };
      if (editing) return api.updateFaculty(id, { ...body, status: v.status });
      return api.createFaculty({ ...body, username: v.username, password: v.password });
    });
    if (res) navigate(`/admin/faculty/${res.faculty.id}`, { state: { flash: res.message } });
  }

  if (loading) return <Loading />;
  if (loadError) return <LoadError error={loadError} />;
  const { values, set, errors } = form;

  return (
    <>
      <PageHeader
        title={editing ? `Edit faculty – ${values.name}` : 'New faculty member'}
        back={{ to: editing ? `/admin/faculty/${id}` : '/admin/faculty', label: editing ? 'Faculty record' : 'Faculty' }}
      />
      <form className="card form-card" onSubmit={onSubmit} noValidate aria-label="Faculty form">
        <Alert onClose={() => form.setMessage('')}>{form.message}</Alert>
        <h2 className="form-section">Personal &amp; department details</h2>
        <div className="grid-2">
          <TextInput label="Full name" name="name" value={values.name} onChange={set} error={errors.name} required hint="e.g. Dr. Kavita Rao" />
          <TextInput label="Department" name="department" value={values.department} onChange={set} error={errors.department} required hint="e.g. CSE" />
          <TextInput label="Designation" name="designation" value={values.designation} onChange={set} error={errors.designation} hint="Optional, e.g. Associate Professor" />
          <TextInput label="Contact email" name="email" type="email" value={values.email} onChange={set} error={errors.email} required />
          <TextInput label="Phone" name="phone" value={values.phone} onChange={set} error={errors.phone} hint="Optional" />
          {editing && (
            <SelectInput
              label="Status" name="status" value={values.status} onChange={set} error={errors.status}
              options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
              hint="Inactive faculty are kept but cannot be assigned new courses."
            />
          )}
        </div>
        {!editing && (
          <>
            <h2 className="form-section">Login account</h2>
            <div className="grid-2">
              <TextInput label="Username" name="username" value={values.username} onChange={set} error={errors.username} hint="Optional – defaults to the part of the email before @" autoComplete="off" />
              <TextInput label="Initial password" name="password" type="password" value={values.password} onChange={set} error={errors.password} required hint="At least 8 characters with a letter and a digit" autoComplete="new-password" />
            </div>
          </>
        )}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={form.busy}>
            {form.busy ? 'Saving…' : editing ? 'Save changes' : 'Create faculty member'}
          </button>
        </div>
      </form>
    </>
  );
}
