import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Alert, EmptyState, LoadError, Loading, PageHeader, StatusBadge, useApi } from '../../components/ui';
import AttendanceTable from '../../components/AttendanceTable';
import MarksTable from '../../components/MarksTable';

/**
 * Course view for the Administrator: details and components (FR-4), the faculty assignment (FR-5),
 * the enrolled students (FR-6), and read-only course attendance / marks (SADS 4.3.6-4.3.7).
 */
export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState('overview');
  const [flash, setFlash] = useState(location.state?.flash || '');
  const [err, setErr] = useState('');
  const course = useApi(() => api.getCourse(id), [id]);
  const roster = useApi(() => api.listEnrollments(id), [id]);

  async function onDelete() {
    if (!window.confirm('Delete this course? If it has a faculty assignment or enrollments it will be deactivated instead.')) return;
    setErr('');
    try {
      const res = await api.deleteCourse(id);
      navigate('/admin/courses', { state: { flash: res.message } });
    } catch (e) {
      if (e.code === 'COURSE_DEACTIVATED_INSTEAD') {
        setFlash(e.message);
        course.reload();
      } else setErr(e.message);
    }
  }

  async function removeStudent(studentId, name) {
    if (!window.confirm(`Remove ${name} from this course? Their past attendance and marks are kept.`)) return;
    try {
      const res = await api.removeEnrollment(id, studentId);
      setFlash(res.message);
      roster.reload();
      course.reload();
    } catch (e) {
      setErr(e.message);
    }
  }

  if (course.loading) return <Loading />;
  if (course.error) return <LoadError error={course.error} />;
  const c = course.data.course;

  return (
    <>
      <PageHeader
        title={<><span className="mono">{c.code}</span> – {c.name}</>}
        subtitle={<>{c.credits} credits · <StatusBadge status={c.status} /></>}
        back={{ to: '/admin/courses', label: 'Courses' }}
        actions={
          <>
            <Link className="btn" to={`/admin/courses/${id}/edit`}>Edit</Link>
            <button className="btn btn-danger" type="button" onClick={onDelete}>Delete</button>
          </>
        }
      />
      <Alert kind="info" onClose={() => setFlash('')}>{flash}</Alert>
      <Alert onClose={() => setErr('')}>{err}</Alert>

      <div className="tabs" role="tablist">
        {[['overview', 'Overview'], ['attendance', 'Attendance'], ['marks', 'Marks']].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} type="button">
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid-2">
          <div className="stack">
            <section className="card">
              <h2>Faculty assignment</h2>
              {c.facultyId ? (
                <p><Link to={`/admin/faculty/${c.facultyId}`}>{c.facultyName}</Link></p>
              ) : (
                <EmptyState>No faculty assigned.</EmptyState>
              )}
              <Link className="btn btn-small" to={`/admin/assignments?courseId=${c.id}`}>
                {c.facultyId ? 'Change / remove assignment' : 'Assign faculty'}
              </Link>
            </section>
            <section className="card">
              <h2>Assessment components</h2>
              {c.components.length === 0 ? (
                <EmptyState>No components configured. Edit the course to add them.</EmptyState>
              ) : (
                <table className="compact">
                  <thead><tr><th>Component</th><th>Maximum marks</th></tr></thead>
                  <tbody>
                    {c.components.map((comp) => (
                      <tr key={comp.id}><td>{comp.name}</td><td>{comp.maxMarks}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
          <section className="card">
            <div className="card-head">
              <h2>Enrolled students ({c.enrolledCount})</h2>
              <Link className="btn btn-small" to={`/admin/enrollments?courseId=${c.id}`}>Enroll students</Link>
            </div>
            {roster.loading && <Loading />}
            <LoadError error={roster.error} />
            {roster.data && (roster.data.enrollments.length === 0 ? (
              <EmptyState>No students enrolled.</EmptyState>
            ) : (
              <div className="table-wrap scroll-y">
                <table className="compact">
                  <thead><tr><th>Roll number</th><th>Name</th><th /></tr></thead>
                  <tbody>
                    {roster.data.enrollments.map((e) => (
                      <tr key={e.studentId}>
                        <td className="mono">{e.rollNumber}</td>
                        <td><Link to={`/admin/students/${e.studentId}`}>{e.name}</Link></td>
                        <td className="row-actions">
                          <button type="button" className="link-btn danger" onClick={() => removeStudent(e.studentId, e.name)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === 'attendance' && <AdminAttendance courseId={id} />}
      {tab === 'marks' && <AdminMarks courseId={id} />}
    </>
  );
}

function AdminAttendance({ courseId }) {
  const { data, error, loading } = useApi(() => api.courseAttendance(courseId), [courseId]);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  return <section className="card"><AttendanceTable data={data} /></section>;
}

function AdminMarks({ courseId }) {
  const { data, error, loading } = useApi(() => api.courseMarks(courseId), [courseId]);
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} />;
  return <section className="card"><MarksTable data={data} /></section>;
}
