import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Consistent navigation and layout across all role screens (SRS 3.1). */
const NAV = {
  ADMIN: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/students', label: 'Students' },
    { to: '/admin/faculty', label: 'Faculty' },
    { to: '/admin/courses', label: 'Courses' },
    { to: '/admin/assignments', label: 'Assignments' },
    { to: '/admin/enrollments', label: 'Enrollments' },
  ],
  FACULTY: [
    { to: '/faculty', label: 'Dashboard', end: true },
    { to: '/faculty/profile', label: 'My Profile & Courses' },
  ],
  STUDENT: [
    { to: '/student', label: 'Dashboard', end: true },
    { to: '/student/profile', label: 'My Profile' },
    { to: '/student/attendance', label: 'Attendance' },
    { to: '/student/marks', label: 'Marks' },
  ],
};

const ROLE_LABEL = { ADMIN: 'Administrator', FACULTY: 'Faculty', STUDENT: 'Student' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">SRS</span>
          <span className="brand-name">Student Record System</span>
        </div>
        <nav className="mainnav" aria-label="Main">
          {(NAV[user.role] || []).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="userbox">
          <div className="user-meta">
            <span className="user-name">{user.displayName}</span>
            <span className="user-role">{ROLE_LABEL[user.role]}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
