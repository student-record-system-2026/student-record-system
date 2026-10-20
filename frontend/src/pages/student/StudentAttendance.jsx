import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, LoadError, Loading, PageHeader, Percent, StatusBadge, formatDate, useApi } from '../../components/ui';

/** Student attendance: session-wise records and percentage per enrolled course (FR-8). */
export default function StudentAttendance() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const courseId = params.get('courseId') || '';
  const all = useApi(() => api.studentAttendance(user.studentId), [user.studentId]);
  const one = useApi(
    () => (courseId ? api.studentAttendance(user.studentId, courseId) : Promise.resolve(null)),
    [user.studentId, courseId]
  );

  if (all.loading) return <Loading />;
  if (all.error) return <LoadError error={all.error} />;
  const courses = courseId ? one.data?.courses || [] : all.data.courses;

  return (
    <>
      <PageHeader title="My Attendance" subtitle="Session-wise attendance and overall percentage for each enrolled course." />
      <div className="toolbar">
        <label htmlFor="att-course" className="inline-label">Course</label>
        <select id="att-course" value={courseId} onChange={(e) => setParams(e.target.value ? { courseId: e.target.value } : {})}>
          <option value="">All enrolled courses</option>
          {all.data.courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.code} – {c.name}</option>)}
        </select>
      </div>
      {courseId && one.loading && <Loading />}
      {courseId && <LoadError error={one.error} />}
      {!one.error && courses.length === 0 && !one.loading && <EmptyState>You are not enrolled in any course.</EmptyState>}
      {!one.error && courses.map((c) => (
        <section key={c.courseId} className="card">
          <div className="card-head">
            <h2><span className="mono">{c.code}</span> – {c.name}</h2>
            <div className="att-summary">
              <Percent value={c.percentage} />
              <span className="muted small">{c.present} present / {c.total} sessions</span>
            </div>
          </div>
          {c.sessions.length === 0 ? <EmptyState>No sessions recorded yet.</EmptyState> : (
            <div className="session-chips">
              {[...c.sessions].reverse().map((s) => (
                <div key={s.sessionDate} className={`chip ${s.status === 'PRESENT' ? 'chip-p' : 'chip-a'}`}>
                  <span>{formatDate(s.sessionDate)}</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
