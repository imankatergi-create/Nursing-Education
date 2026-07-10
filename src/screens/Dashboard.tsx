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

const ROLE_DASH: Record<string, { title: string; subtitle: string }> = {
  superadmin: { title: 'System Overview', subtitle: 'Full platform analytics' },
  admin: { title: 'Administration Dashboard', subtitle: 'Manage staff training' },
  educator: { title: 'Educator Dashboard', subtitle: 'Your courses and learners' },
  supervisor: { title: 'Supervisor Dashboard', subtitle: "Your unit's progress" },
  director: { title: 'Director Dashboard', subtitle: 'Strategic overview' },
  it: { title: 'IT Dashboard', subtitle: 'System health and users' },
}

export default function Dashboard() {
  const { role, navigate } = useApp()
  const [stats, setStats] = useState<Stats>({
    total_nurses: 0, active_courses: 0, completion_rate: 0,
    overdue_count: 0, done_pct: 0, inprog_pct: 0, overdue_pct: 0,
  })

  useEffect(() => {
    ;(async () => {
      const [nurses, courses, enrollments] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'nurse'),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('nurse_enrollments').select('status,due_date'),
      ])
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
          <div className="bar-chart">
            {[
              { dept: 'ICU', pct: 94 },
              { dept: 'Emergency', pct: 88 },
              { dept: 'Oncology', pct: 82 },
              { dept: 'Pediatrics', pct: 79 },
              { dept: 'Surgery', pct: 91 },
            ].map(r => (
              <div key={r.dept} className="bar-row">
                <div className="bar-label">{r.dept}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${r.pct}%` }} />
                </div>
                <div className="bar-value">{r.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-list">
            {[
              { user: 'Rania Khalil', action: 'Completed', item: 'BLS/CPR Recertification', time: '2h ago', icon: '✅' },
              { user: 'Ahmad Saleh', action: 'Started', item: 'Patient Safety Fundamentals', time: '4h ago', icon: '▶️' },
              { user: 'Sara Mansour', action: 'Passed quiz', item: 'Hand Hygiene Protocol', time: '6h ago', icon: '🎯' },
              { user: 'Omar Haddad', action: 'Downloaded', item: 'IV Insertion Checklist', time: '1d ago', icon: '📥' },
              { user: 'Lina Khoury', action: 'Published', item: 'New course: Sepsis Protocol', time: '2d ago', icon: '🆕' },
            ].map((a, i) => (
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
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Top Courses by Enrollment</h3>
            <button className="btn btn-sm" onClick={() => navigate('courses')}>All Courses</button>
          </div>
          <div className="course-mini-list">
            {[
              { title: 'BLS/CPR Recertification', enrolled: 142, pct: 78 },
              { title: 'Patient Safety Fundamentals', enrolled: 118, pct: 91 },
              { title: 'Hand Hygiene Protocol', enrolled: 134, pct: 95 },
              { title: 'IV Insertion & Management', enrolled: 96, pct: 64 },
              { title: 'Sepsis Bundle Protocol', enrolled: 87, pct: 71 },
            ].map((c, i) => (
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
