import { useState } from 'react';

/**
 * Minimal form-state helper. Field errors come from the API's validation envelope
 * (SADS 4.4) so the server stays the single source of validation rules (NFR-4).
 */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  /** Run an async submit; on ApiError show the message and per-field errors. */
  async function submit(fn) {
    setBusy(true);
    setMessage('');
    setErrors({});
    try {
      return await fn(values);
    } catch (err) {
      setMessage(err.message || 'Something went wrong.');
      if (err.fieldErrors) setErrors(err.fieldErrors());
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  return { values, setValues, set, errors, setErrors, message, setMessage, busy, submit };
}
