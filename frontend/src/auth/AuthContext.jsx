import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onUnauthorized } from '../api/client';

/**
 * Holds the logged-in user (from the server session) for the Presentation Layer.
 * The UI never decides access on its own: every page's data comes from the API, which
 * re-checks authentication and role on each request (SADS 3.6).
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api.session();
      setUser(u);
    } catch (_) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // A protected request answered 401 -> the session ended (logout elsewhere / expiry). NFR-8.
    onUnauthorized(() => {
      setUser(null);
      setNotice('Your session has ended. Please log in again.');
    });
    // Page restored from the browser's back/forward cache: re-validate the session. NFR-8.
    const onPageShow = (e) => {
      if (e.persisted) refresh();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    setNotice('');
    setUser(res.user);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (_) {
      /* already logged out server-side */
    }
    setUser(null);
    setNotice('You have been logged out.');
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, notice, setNotice }),
    [user, loading, login, logout, notice]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { AuthContext };
