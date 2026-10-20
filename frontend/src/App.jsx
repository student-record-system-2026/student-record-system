import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import LoginPage from './pages/LoginPage';
import NotFound from './pages/NotFound';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentsPage from './pages/admin/StudentsPage';
import StudentFormPage from './pages/admin/StudentFormPage';
import StudentDetailPage from './pages/admin/StudentDetailPage';
import FacultyPage from './pages/admin/FacultyPage';
import FacultyFormPage from './pages/admin/FacultyFormPage';
import FacultyDetailPage from './pages/admin/FacultyDetailPage';
import CoursesPage from './pages/admin/CoursesPage';
import CourseFormPage from './pages/admin/CourseFormPage';
import CourseDetailPage from './pages/admin/CourseDetailPage';
import AssignmentsPage from './pages/admin/AssignmentsPage';
import EnrollmentsPage from './pages/admin/EnrollmentsPage';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultyProfile from './pages/faculty/FacultyProfile';
import AttendancePage from './pages/faculty/AttendancePage';
import MarksPage from './pages/faculty/MarksPage';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentProfile from './pages/student/StudentProfile';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentMarks from './pages/student/StudentMarks';

/** "/" sends a logged-in user to their role dashboard (FR-1), otherwise to login. */
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? user.dashboard : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route element={<Layout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/students" element={<StudentsPage />} />
          <Route path="/admin/students/new" element={<StudentFormPage />} />
          <Route path="/admin/students/:id" element={<StudentDetailPage />} />
          <Route path="/admin/students/:id/edit" element={<StudentFormPage />} />
          <Route path="/admin/faculty" element={<FacultyPage />} />
          <Route path="/admin/faculty/new" element={<FacultyFormPage />} />
          <Route path="/admin/faculty/:id" element={<FacultyDetailPage />} />
          <Route path="/admin/faculty/:id/edit" element={<FacultyFormPage />} />
          <Route path="/admin/courses" element={<CoursesPage />} />
          <Route path="/admin/courses/new" element={<CourseFormPage />} />
          <Route path="/admin/courses/:id" element={<CourseDetailPage />} />
          <Route path="/admin/courses/:id/edit" element={<CourseFormPage />} />
          <Route path="/admin/assignments" element={<AssignmentsPage />} />
          <Route path="/admin/enrollments" element={<EnrollmentsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['FACULTY']} />}>
        <Route element={<Layout />}>
          <Route path="/faculty" element={<FacultyDashboard />} />
          <Route path="/faculty/profile" element={<FacultyProfile />} />
          <Route path="/faculty/courses/:id/attendance" element={<AttendancePage />} />
          <Route path="/faculty/courses/:id/marks" element={<MarksPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['STUDENT']} />}>
        <Route element={<Layout />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/profile" element={<StudentProfile />} />
          <Route path="/student/attendance" element={<StudentAttendance />} />
          <Route path="/student/marks" element={<StudentMarks />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
