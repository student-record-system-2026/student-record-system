import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, LoadError, Loading, PageHeader, useApi } from '../../components/ui';

/** Student marks per assessment component for each enrolled course (FR-10). */
export default function StudentMarks() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const courseId = params.get('courseId') || '';
  const all = useApi(() => api.studentMarks(user.studentId), [user.studentId]);
  const one = useApi(
    () => (courseId ? api.studentMarks(user.studentId, courseId) : Promise.resolve(null)),
    [user.studentId, courseId]
  );

  if (all.loading) return <Loading />;
  if (all.error) return <LoadError error={all.error} />;
  const courses = courseId ? one.data?.courses || [] : all.data.courses;

  return (
    <>
      <PageHeader title="My Marks" subtitle="Marks obtained in each assessment component of your enrolled courses." />
      <div className="toolbar">
        <label htmlFor="marks-course" className="inline-label">Course</label>
        <select id="marks-course" value={courseId} onChange={(e) => setParams(e.target.value ? { courseId: e.target.value } : {})}>
          <option value="">All enrolled courses</option>
          {all.data.courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.code} – {c.name}</option>)}
        </select>
      </div>
      {courseId && one.loading && <Loading />}
      {courseId && <LoadError error={one.error} />}
      {!one.error && courses.length === 0 && !one.loading && <EmptyState>You are not enrolled in any course.</EmptyState>}
      <div className="course-grid">
        {!one.error && courses.map((c) => (
          <section key={c.courseId} className="card">
            <h2><span className="mono">{c.code}</span> – {c.name}</h2>
            {c.components.length === 0 ? <EmptyState>No assessment components configured.</EmptyState> : (
              <table className="compact">
                <thead><tr><th>Component</th><th className="center">Marks</th><th className="center">Maximum</th></tr></thead>
                <tbody>
                  {c.components.map((comp) => (
                    <tr key={comp.componentId}>
                      <td>{comp.name}</td>
                      <td className="center strong">{comp.marksObtained ?? <span className="muted">Not entered</span>}</td>
                      <td className="center">{comp.maxMarks}</td>
                    </tr>
                  ))}
                </tbody>
                {c.enteredCount > 0 && (
                  <tfoot>
                    <tr><td>Total (entered components)</td><td className="center strong">{c.totalObtained}</td><td className="center">{c.totalMaxEntered}</td></tr>
                  </tfoot>
                )}
              </table>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
