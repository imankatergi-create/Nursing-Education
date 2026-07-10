import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface DeptStat { dept: string; nurses: number; completed: number; pct: number }
interface CourseStat { title: string; enrolled: number; completed: number; pct: number }
interface AtRisk { name: string; dept: string; done: number; assigned: number; overdue: number }

export default function ReportsScreen() {
  const { toast } = useApp()
  const [deptData, setDeptData] = useState<DeptStat[]>([])
  const [courseData, setCourseData] = useState<CourseStat[]>([])
  const [atRisk, setAtRisk] = useState<AtRisk[]>([])
  const [kpis, setKpis] = useState({ nurses: 0, completion: 0, courses: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReports() }, [])

  async function fetchReports() {
    setLoading(true)
    const [nursesRes, coursesRes, deptRes, courseStatsRes, enrRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'nurse'),
      supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.rpc('get_dept_coverage'),
      supabase.rpc('get_course_completion_stats'),
      supabase.from('nurse_enrollments').select('profile_id,status,due_date'),
    ])

    const totalNurses = nursesRes.count ?? 0
    const totalCourses = coursesRes.count ?? 0

    // Dept coverage
    if (deptRes.data && deptRes.data.length > 0) {
      setDeptData(deptRes.data.map((d: { dept_id: string; nurse_count: number; courses_done: number; coverage_pct: number }) => ({
        dept: d.dept_id, nurses: d.nurse_count,
        completed: d.courses_done, pct: d.coverage_pct,
      })))
    }

    // Course stats
    if (courseStatsRes.data && courseStatsRes.data.length > 0) {
      setCourseData(courseStatsRes.data.slice(0, 8).map((c: { course_title: string; enrolled: number; completed: number; pct: number }) => ({
        title: c.course_title, enrolled: c.enrolled, completed: c.completed, pct: c.pct,
      })))
    }

    // KPIs from enrollment data
    const enr = enrRes.data ?? []
    const totalEnr = enr.length
    const doneEnr = enr.filter(e => e.status === 'completed').length
    const overdueEnr = enr.filter(e => e.due_date && new Date(e.due_date) < new Date() && e.status !== 'completed').length
    const compPct = totalEnr > 0 ? Math.round((doneEnr / totalEnr) * 100) : 0

    // At-risk nurses (overdue enrollments > 0)
    const overduePer: Record<string, number> = {}
    const assignedPer: Record<string, number> = {}
    const donePer: Record<string, number> = {}
    for (const e of enr) {
      assignedPer[e.profile_id] = (assignedPer[e.profile_id] ?? 0) + 1
      if (e.status === 'completed') donePer[e.profile_id] = (donePer[e.profile_id] ?? 0) + 1
      if (e.due_date && new Date(e.due_date) < new Date() && e.status !== 'completed') {
        overduePer[e.profile_id] = (overduePer[e.profile_id] ?? 0) + 1
      }
    }

    const atRiskIds = Object.entries(overduePer).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
    if (atRiskIds.length > 0) {
      const { data: profData } = await supabase.from('profiles').select('id,full_name,dept_id').in('id', atRiskIds.map(([id]) => id))
      setAtRisk((profData ?? []).map(p => ({
        name: p.full_name, dept: p.dept_id ?? '—',
        done: donePer[p.id] ?? 0, assigned: assignedPer[p.id] ?? 0,
        overdue: overduePer[p.id] ?? 0,
      })))
    }

    setKpis({ nurses: totalNurses, completion: compPct || 0, courses: totalCourses, overdue: overdueEnr })
    setLoading(false)
  }

  if (loading) return <div className="screen-container"><div className="loading-state">Loading reports…</div></div>

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Reports</h1>
          <p className="screen-subtitle">Analytics and compliance reporting</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => toast('Generating PDF…')}>Export PDF</button>
          <button className="btn btn-outline" onClick={() => toast('Generating Excel…')}>Export Excel</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-teal"><div className="kpi-icon">👥</div><div className="kpi-body"><div className="kpi-value">{kpis.nurses}</div><div className="kpi-label">Total Nurses</div></div></div>
        <div className="kpi-card kpi-green"><div className="kpi-icon">✅</div><div className="kpi-body"><div className="kpi-value">{kpis.completion}%</div><div className="kpi-label">Overall Completion</div></div></div>
        <div className="kpi-card kpi-blue"><div className="kpi-icon">📚</div><div className="kpi-body"><div className="kpi-value">{kpis.courses}</div><div className="kpi-label">Active Courses</div></div></div>
        <div className="kpi-card kpi-red"><div className="kpi-icon">⚠️</div><div className="kpi-body"><div className="kpi-value">{kpis.overdue}</div><div className="kpi-label">Overdue</div></div></div>
      </div>

      <div className="reports-grid">
        <div className="card">
          <div className="card-header"><h3>Completion by Department</h3></div>
          {deptData.length > 0 ? (
            <div className="bar-chart">
              {deptData.map(d => (
                <div key={d.dept} className="bar-row">
                  <div className="bar-label">{d.dept}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${d.pct}%`, background: d.pct >= 90 ? 'var(--green)' : d.pct >= 75 ? 'var(--teal)' : 'var(--amber)' }} />
                  </div>
                  <div className="bar-value">{d.pct}% <span className="bar-sub">({d.nurses} nurses)</span></div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">No department data yet</div>}
        </div>

        <div className="card">
          <div className="card-header"><h3>Course Completion Rates</h3></div>
          {courseData.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Course</th><th>Enrolled</th><th>Completed</th><th>Rate</th></tr></thead>
                <tbody>
                  {courseData.map((c, i) => (
                    <tr key={i}>
                      <td>{c.title}</td>
                      <td>{c.enrolled}</td>
                      <td>{c.completed}</td>
                      <td>
                        <div className="progress-cell">
                          <div className="bar-track sm"><div className="bar-fill" style={{ width: `${c.pct}%` }} /></div>
                          <span>{c.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state">No course data yet — assign courses to nurses to see stats</div>}
        </div>

        {atRisk.length > 0 && (
          <div className="card">
            <div className="card-header"><h3>At-Risk Nurses (Overdue)</h3></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Dept</th><th>Done/Assigned</th><th>Overdue</th></tr></thead>
                <tbody>
                  {atRisk.map((n, i) => (
                    <tr key={i}>
                      <td>{n.name}</td>
                      <td>{n.dept}</td>
                      <td>{n.done}/{n.assigned}</td>
                      <td><span className="badge badge-red">{n.overdue}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
