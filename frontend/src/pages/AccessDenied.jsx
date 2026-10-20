import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Shown when an authenticated user opens a screen outside their role (TC-01 step 7, SO-3). */
export default function AccessDenied() {
  const { user } = useAuth();
  return (
    <div className="center-page">
      <div className="card narrow denied" role="alert">
        <h1>Access denied</h1>
        <p>Your account does not have permission to open this screen.</p>
        {user && (
          <Link className="btn btn-primary" to={user.dashboard}>
            Go to my dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
