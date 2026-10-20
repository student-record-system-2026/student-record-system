import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/ui';

/** Shared login screen (FR-1; SADS Sequence Diagram 1). */
export default function LoginPage() {
  const { user, login, notice, setNotice } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.dashboard} replace />;

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    setNotice('');
    // Basic form check only; the server performs the real validation.
    const errs = {};
    if (!form.username.trim()) errs.username = 'Username or email is required.';
    if (!form.password) errs.password = 'Password is required.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const res = await login(form.username.trim(), form.password);
      navigate(res.redirectTo, { replace: true });
    } catch (err) {
      setMessage(err.message);
      setForm((f) => ({ ...f, password: '' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <span className="brand-mark large" aria-hidden="true">SRS</span>
          <h1>Student Record System</h1>
          <p>Sign in with the account provided by your administrator.</p>
        </div>
        <form className="card login-card" onSubmit={submit} noValidate aria-label="Login form">
          {notice && <Alert kind="info">{notice}</Alert>}
          {message && <Alert>{message}</Alert>}
          <div className={`field ${errors.username ? 'has-error' : ''}`}>
            <label htmlFor="username">Username or email</label>
            <input id="username" name="username" autoComplete="username" value={form.username} onChange={set} autoFocus />
            {errors.username && <div className="field-error">{errors.username}</div>}
          </div>
          <div className={`field ${errors.password ? 'has-error' : ''}`}>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={set} />
            {errors.password && <div className="field-error">{errors.password}</div>}
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <p className="login-foot">PES University · Software Engineering mini-project · v1.0</p>
      </div>
    </div>
  );
}
