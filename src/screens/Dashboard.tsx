import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface Stats {
  total_nurses: number
  active_courses: number
  completion_rate: number
  overdue_count: number
  done_pct: number
  inprog_pct: number
  overdue_pct: number
}
interface TopCourse { title: string; enrolled: number; pct: number }
interface DeptStat { dept: string; pct: number }
interface ActivityItem { icon: string; user: string; action: string; item: string; time: string }

const ROLE_DASH: Record<string, { title: string; subtitle: string }> = {
  superadmin: { title: 'System Overview', subtitle: 'Full platform analytics' },
  admin: { title: 'Administration Dashboard', subtitle: 'Manage staff training' },
  educator: { title: 'Educator Dashboard', subtitle: 'Your courses and learners' },
  supervisor: { title: 'Supervisor Dashboard', subtitle: "Your unit's progress" },
  director: { title: 'Director Dashboard', subtitle: 'Strategic overview' },
  it: { title: 'IT Dashboard', subtitle: 'System health and users' },
}

const STATUS_META: Record<string, { icon: string; action: string }> = {
  completed:   { icon: '✅', action: 'Completed' },
  in_progress: { icon: '▶️', action: 'Started' },
  not_started: { icon: '📋', action: 'Enrolled in' },
  overdue:     { icon: '⚠️', action: 'Overdue for' },
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return `${Math.floor(d / 7)}w ago`
}

export default function Dashboard() {
  const { role, navigate } = useApp()
  const [stats, setStats] = useState<Stats>({
    total_nurses: 0, active_courses: 0, completion_rate: 0,
    overdue_count: 0, done_pct: 0, inprog_pct: 0, overdue_pct: 0,
  })
  const [topCourses, setTopCourses] = useState<TopCourse[]>([])
  const [deptData, setDeptData] = useState<DeptStat[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    ;(async () => {
      const [nurses, courses, enrollments, courseStats, deptStats, recentEnr] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'nurse'),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('nurse_enrollments').select('status,due_date'),
        supabase.rpc('get_course_completion_stats'),
        supabase.rpc('get_dept_coverage'),
        supabase.from('nurse_enrollments')
          .select('status, completed_at, enrolled_at, profiles(full_name), courses(title)')
          .order('enrolled_at', { ascending: false })
          .limit(8),
      ])

      // KPI stats
      const enr = enrollments.data ?? []
      const total = enr.length
      const now = new Date()
      const done = enr.filter(e => e.status === 'completed').length
      const overdue = enr.filter(e => e.due_date && new Date(e.due_date) < now && e.status !== 'completed').length
      const inprog = enr.filter(e => e.status === 'in_progress').length
      const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0

      setStats({
        total_nurses: nurses.count ?? 0,
        active_courses: courses.count ?? 0,
        completion_rate: pct(done),
        overdue_count: overdue,
        done_pct: pct(done),
        inprog_pct: pct(inprog),
        overdue_pct: pct(overdue),
      })

      // Top courses
      if (courseStats.data && courseStats.data.length > 0) {
        setTopCourses(courseStats.data.slice(0, 5).map((c: { course_title: string; enrolled: number; pct: number }) => ({
          title: c.course_title, enrolled: c.enrolled, pct: c.pct,
        })))
      }

      // Department completion
      if (deptStats.data && deptStats.data.length > 0) {
        setDeptData(deptStats.data.map((d: { dept_id: string; coverage_pct: number }) => ({
          dept: d.dept_id, pct: d.coverage_pct,
        })))
      }

      // Recent activity from enrollments
      if (recentEnr.data && recentEnr.data.length > 0) {
        const items: ActivityItem[] = recentEnr.data.map((e: {
          status: string
          completed_at: string | null
          enrolled_at: string
          profiles: { full_name: string }[] | null
          courses: { title: string }[] | null
        }) => {
          const meta = STATUS_META[e.status] ?? { icon: '📋', action: 'Updated' }
          const date = e.status === 'completed' ? e.completed_at : e.enrolled_at
          const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
          const course = Array.isArray(e.courses) ? e.courses[0] : e.courses
          return {
            icon: meta.icon,
            user: (profile as { full_name: string } | null)?.full_name ?? 'Unknown',
            action: meta.action,
            item: (course as { title: string } | null)?.title ?? 'Unknown Course',
            time: timeAgo(date),
          }
        })
        setActivity(items)
      }
    })()
  }, [])

  const dash = ROLE_DASH[role] ?? ROLE_DASH.admin
  const circumference = 251.3

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
            <div className="kpi-value">{stats.total_nurses}</div>
            <div className="kpi-label">Total Nurses</div>
          </div>
        </div>
        <div className="kpi-card kpi-blue">
          <div className="kpi-icon">📚</div>
          <div className="kpi-body">
            <div className="kpi-value">{stats.active_courses}</div>
            <div className="kpi-label">Active Courses</div>
          </div>
        </div>
        <div className="kpi-card kpi-green">
          <div className="kpi-icon">✅</div>
          <div className="kpi-body">
            <div className="kpi-value">{stats.completion_rate}%</div>
            <div className="kpi-label">Completion Rate</div>
          </div>
        </div>
        <div className="kpi-card kpi-red">
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-body">
            <div className="kpi-value">{stats.overdue_count}</div>
            <div className="kpi-label">Overdue</div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <h3>Department Completion</h3>
            <button className="btn btn-sm" onClick={() => navigate('reports')}>View Report</button>
          </div>
          {deptData.length > 0 ? (
            <div className="bar-chart">
              {deptData.map(r => (
                <div key={r.dept} className="bar-row">
                  <div className="bar-label">{r.dept}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${r.pct}%` }} />
                  </div>
                  <div className="bar-value">{r.pct}%</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No department data yet</div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-list">
            {activity.length > 0 ? activity.map((a, i) => (
              <div key={i} className="activity-item">
                <span className="activity-icon">{a.icon}</span>
                <div className="activity-body">
                  <span className="activity-user">{a.user}</span>
                  <span className="activity-action"> {a.action} </span>
                  <span className="activity-item-name">{a.item}</span>
                </div>
                <span className="activity-time">{a.time}</span>
              </div>
            )) : (
              <div className="empty-state">No activity yet</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Top Courses by Enrollment</h3>
            <button className="btn btn-sm" onClick={() => navigate('courses')}>All Courses</button>
          </div>
          {topCourses.length > 0 ? (
            <div className="course-mini-list">
              {topCourses.map((c, i) => (
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
          ) : (
            <div className="empty-state">No enrollment data yet</div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Compliance Summary</h3>
          </div>
          <div className="compliance-donut-wrap">
            <svg viewBox="0 0 100 100" className="donut-svg">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="12" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--teal)" strokeWidth="12"
                strokeDasharray={`${(stats.done_pct / 100) * circumference} ${circumference}`}
                strokeDashoffset="62.8" strokeLinecap="round" />
            </svg>
            <div className="donut-label">
              <div className="donut-value">{stats.done_pct}%</div>
              <div className="donut-sub">Compliant</div>
            </div>
          </div>
          <div className="compliance-legend">
            <div className="legend-row"><span className="legend-dot teal" />Completed <strong>{stats.done_pct}%</strong></div>
            <div className="legend-row"><span className="legend-dot amber" />In Progress <strong>{stats.inprog_pct}%</strong></div>
            <div className="legend-row"><span className="legend-dot red" />Overdue <strong>{stats.overdue_pct}%</strong></div>
          </div>
        </div>
      </div>
    </div>
  )
}
