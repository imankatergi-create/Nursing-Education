import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface KPIs {
  total_nurses: number
  nurses_this_month: number
  active_courses: number
  courses_this_month: number
  completion_pct: number
  in_progress_pct: number
  overdue_pct: number
  overdue_count: number
}

interface DeptStat { dept: string; pct: number }
interface CourseStat { title: string; enrolled: number; pct: number }
interface ActivityItem { user: string; action: string; item: string; time: string; icon: string }

const ROLE_DASH: Record<string, { title: string; subtitle: string }> = {
  superadmin: { title: 'System Overview', subtitle: 'Full platform analytics' },
  admin: { title: 'Administration Dashboard', subtitle: 'Manage staff training' },
  educator: { title: 'Educator Dashboard', subtitle: 'Your courses and learners' },
  supervisor: { title: 'Supervisor Dashboard', subtitle: "Your unit's progress" },
  director: { title: 'Director Dashboard', subtitle: 'Strategic overview' },
  it: { title: 'IT Dashboard', subtitle: 'System health and users' },
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default function Dashboard() {
  const { role, navigate } = useApp()
  const [kpis, setKpis] = useState<KPIs>({
    total_nurses: 0, nurses_this_month: 0,
    active_courses: 0, courses_this_month: 0,
    completion_pct: 0, in_progress_pct: 0, overdue_pct: 0, overdue_count: 0,
  })
  const [deptStats, setDeptStats] = useState<DeptStat[]>([])
  const [courseStats, setCourseStats] = useState<CourseStat[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const monthIso = monthStart.toISOString()
    const now = new Date().toISOString()

    const [nursesRes, nursesMthRes, coursesRes, coursesMthRes, enrRes, deptRes, courseStatsRes, lpRes] =
      await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'nurse'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'nurse').gte('created_at', monthIso),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', monthIso),
        supabase.from('nurse_enrollments').select('status, due_date'),
        supabase.rpc('get_dept_coverage'),
        supabase.rpc('get_course_completion_stats'),
        supabase.from('lesson_progress')
          .select('profile_id, lesson_id, status, completed_at')
          .not('completed_at', 'is', null)
          .lte('completed_at', now)
          .order('completed_at', { ascending: false })
          .limit(10),
      ])

    // KPIs from enrollment data
    const enr = enrRes.data ?? []
    const total = enr.length
    const done = enr.filter(e => e.status === 'completed').length
    const inProg = enr.filter(e => e.status === 'in_progress').length
    const overdue = enr.filter(e => e.due_date && e.due_date < now && e.status !== 'completed').length
    const compPct = total > 0 ? Math.round((done / total) * 100) : 0
    const inProgPct = total > 0 ? Math.round((inProg / total) * 100) : 0
    const overduePct = total > 0 ? Math.round((overdue / total) * 100) : 0

    setKpis({
      total_nurses: nursesRes.count ?? 0,
      nurses_this_month: nursesMthRes.count ?? 0,
      active_courses: coursesRes.count ?? 0,
      courses_this_month: coursesMthRes.count ?? 0,
      completion_pct: compPct,
      in_progress_pct: inProgPct,
      overdue_pct: overduePct,
      overdue_count: overdue,
    })

    // Department completion from RPC
    if (deptRes.data && deptRes.data.length > 0) {
      setDeptStats(deptRes.data.slice(0, 7).map((d: { dept_id: string; coverage_pct: number }) => ({
        dept: d.dept_id,
        pct: Math.round(d.coverage_pct ?? 0),
      })))
    }

    // Top courses by enrollment
    if (courseStatsRes.data && courseStatsRes.data.length > 0) {
      setCourseStats(courseStatsRes.data.slice(0, 5).map((c: { course_title: string; enrolled: number; pct: number }) => ({
        title: c.course_title, enrolled: c.enrolled, pct: Math.round(c.pct ?? 0),
      })))
    }

    // Recent activity from lesson_progress
    const lpData = lpRes.data ?? []
    if (lpData.length > 0) {
      const profileIds = [...new Set(lpData.map(r => r.profile_id))]
      const lessonIds = [...new Set(lpData.map(r => r.lesson_id))]
      const [{ data: profData }, { data: lessData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', profileIds),
        supabase.from('lessons').select('id, title, lesson_type').in('id', lessonIds),
      ])
      const profMap = Object.fromEntries((profData ?? []).map(p => [p.id, p.full_name]))
      const lessMap = Object.fromEntries((lessData ?? []).map(l => [l.id, { title: l.title, type: l.lesson_type }]))
      setActivity(lpData.slice(0, 5).map(r => {
        const lt = lessMap[r.lesson_id]?.type ?? 'video'
        return {
          user: profMap[r.profile_id] ?? 'Staff',
          action: lt === 'quiz' ? 'Completed quiz in' : lt === 'document' ? 'Read document' : 'Watched video',
          item: lessMap[r.lesson_id]?.title ?? 'Lesson',
          time: r.completed_at ? timeAgo(r.completed_at) : '',
          icon: lt === 'quiz' ? '🎯' : lt === 'document' ? '📄' : '▶️',
        }
      }))
    }

    setLoading(false)
  }

  const dash = ROLE_DASH[role] ?? ROLE_DASH.admin
  const CIRC = 40 * 2 * Math.PI // circumference of r=40

  if (loading) return <div className="screen-container"><div className="loading-state">Loading dashboard…</div></div>

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">{dash.title}</h1>
          <p className="screen-subtitle">{dash.subtitle}</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-teal">
          <div className="kpi-icon">👥</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis.total_nurses}</div>
            <div className="kpi-label">Total Nurses</div>
          </div>
          {kpis.nurses_this_month > 0 && (
            <div className="kpi-delta positive">+{kpis.nurses_this_month} this month</div>
          )}
        </div>
        <div className="kpi-card kpi-blue">
          <div className="kpi-icon">📚</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis.active_courses}</div>
            <div className="kpi-label">Active Courses</div>
          </div>
          {kpis.courses_this_month > 0 && (
            <div className="kpi-delta positive">+{kpis.courses_this_month} new</div>
          )}
        </div>
        <div className="kpi-card kpi-green">
          <div className="kpi-icon">✅</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis.completion_pct}%</div>
            <div className="kpi-label">Completion Rate</div>
          </div>
          {kpis.in_progress_pct > 0 && (
            <div className="kpi-delta positive">{kpis.in_progress_pct}% in progress</div>
          )}
        </div>
        <div className={`kpi-card kpi-${kpis.overdue_count > 0 ? 'red' : 'green'}`}>
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis.overdue_count}</div>
            <div className="kpi-label">Overdue</div>
          </div>
          {kpis.overdue_pct > 0 && (
            <div className="kpi-delta negative">{kpis.overdue_pct}% of total</div>
          )}
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <h3>Department Completion</h3>
            <button className="btn btn-sm" onClick={() => navigate('reports')}>View Report</button>
          </div>
          {deptStats.length > 0 ? (
            <div className="bar-chart">
              {deptStats.map(r => (
                <div key={r.dept} className="bar-row">
                  <div className="bar-label">{r.dept}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${r.pct}%`, background: r.pct >= 90 ? 'var(--green)' : r.pct >= 75 ? 'var(--teal)' : 'var(--amber)' }} />
                  </div>
                  <div className="bar-value">{r.pct}%</div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">Assign courses to nurses to see department stats</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          {activity.length > 0 ? (
            <div className="activity-list">
              {activity.map((a, i) => (
                <div key={i} className="activity-item">
                  <span className="activity-icon">{a.icon}</span>
                  <div className="activity-body">
                    <span className="activity-user">{a.user}</span>
                    <span className="activity-action"> {a.action} </span>
                    <span className="activity-item-name">{a.item}</span>
                  </div>
                  <span className="activity-time">{a.time}</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">No recent activity yet</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Top Courses by Enrollment</h3>
            <button className="btn btn-sm" onClick={() => navigate('courses')}>All Courses</button>
          </div>
          {courseStats.length > 0 ? (
            <div className="course-mini-list">
              {courseStats.map((c, i) => (
                <div key={i} className="course-mini-row">
                  <div className="course-mini-info">
                    <span className="course-mini-title">{c.title}</span>
                    <span className="course-mini-enrolled">{c.enrolled} enrolled</span>
                  </div>
                  <div className="course-mini-progress">
                    <div className="bar-track sm">
                      <div className="bar-fill" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span>{c.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-state">No course enrollment data yet</div>}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Compliance Summary</h3>
          </div>
          <div className="compliance-donut-wrap">
            <svg viewBox="0 0 100 100" className="donut-svg">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="12" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--teal)" strokeWidth="12"
                strokeDasharray={`${kpis.completion_pct * CIRC / 100} ${CIRC}`}
                strokeDashoffset={CIRC * 0.25} strokeLinecap="round" />
            </svg>
            <div className="donut-label">
              <div className="donut-value">{kpis.completion_pct}%</div>
              <div className="donut-sub">Compliant</div>
            </div>
          </div>
          <div className="compliance-legend">
            <div className="legend-row"><span className="legend-dot teal" />Completed <strong>{kpis.completion_pct}%</strong></div>
            <div className="legend-row"><span className="legend-dot amber" />In Progress <strong>{kpis.in_progress_pct}%</strong></div>
            <div className="legend-row"><span className="legend-dot red" />Overdue <strong>{kpis.overdue_pct}%</strong></div>
          </div>
        </div>
      </div>
    </div>
  )
}
