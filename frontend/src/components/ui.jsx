import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** Small shared UI building blocks (Presentation Layer only - no business rules). */

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function Alert({ kind = 'error', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header">
      <div>
        {back && (
          <Link className="back-link" to={back.to}>
            ← {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = (status || '').toUpperCase();
  const cls = s === 'ACTIVE' || s === 'PRESENT' ? 'ok' : s === 'ABSENT' ? 'bad' : 'muted';
  const label = s.charAt(0) + s.slice(1).toLowerCase();
  return <span className={`badge badge-${cls}`}>{label}</span>;
}

/** Labelled input with inline error text and an optional hint (SRS 2.6 in-app guidance). */
export function Field({ label, name, error, hint, children, required }) {
  const id = `f-${name}`;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children(id)}
      {hint && !error && <div className="hint">{hint}</div>}
      {error && (
        <div className="field-error" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  );
}

export function TextInput({ label, name, value, onChange, error, hint, required, type = 'text', ...rest }) {
  return (
    <Field label={label} name={name} error={error} hint={hint} required={required}>
      {(id) => (
        <input
          id={id}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(name, e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
      )}
    </Field>
  );
}

export function SelectInput({ label, name, value, onChange, error, hint, required, options, placeholder }) {
  return (
    <Field label={label} name={name} error={error} hint={hint} required={required}>
      {(id) => (
        <select
          id={id}
          name={name}
          value={value ?? ''}
          onChange={(e) => onChange(name, e.target.value)}
          aria-invalid={Boolean(error)}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function EmptyState({ children }) {
  return <div className="empty">{children}</div>;
}

export function StatCard({ label, value, sub, to }) {
  const body = (
    <>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </>
  );
  return to ? (
    <Link className="stat-card link" to={to}>
      {body}
    </Link>
  ) : (
    <div className="stat-card">{body}</div>
  );
}

export function Percent({ value }) {
  if (value === null || value === undefined) return <span className="muted">No sessions yet</span>;
  const cls = value >= 75 ? 'ok' : value >= 65 ? 'warn' : 'bad';
  return <span className={`pct pct-${cls}`}>{value}%</span>;
}

/**
 * Load data from an API call; re-runs when `deps` change.
 * Returns { data, error, loading, reload, setData }.
 */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await load();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, [load]);
  useEffect(() => {
    reload();
  }, [reload]);
  const setData = (data) => setState((s) => ({ ...s, data }));
  return { ...state, reload, setData };
}

/** Standard rendering for a failed load (403 / 404 / other). */
export function LoadError({ error }) {
  if (!error) return null;
  if (error.status === 403) {
    return (
      <div className="denied-inline" role="alert">
        <h2>Access denied</h2>
        <p>{error.message}</p>
      </div>
    );
  }
  return <Alert>{error.message}</Alert>;
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayIso() {
  const n = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}
