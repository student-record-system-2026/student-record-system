import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Loading } from '../components/ui';
import AccessDenied from '../pages/AccessDenied';

/**
 * Route guard (FR-1 RBAC in the UI). Unauthenticated users go to the login screen;
 * authenticated users of the wrong role see an "Access denied" screen.
 * This is a usability layer only - the API enforces the same rules server-side.
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <AccessDenied />;
  return <Outlet />;
}
