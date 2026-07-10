import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

interface CourseSummary {
  courseId: string
  title: string
  category: string
  duration: string
  thumbnail_icon: string
  status: string
  pct: number
}

interface CertSummary { id: string; course_name: string; issued_at: string; expiry_date: string; status: string }
interface NotifSummary { id: string; message: string; sent_at: string; read: boolean }

const statusColor: Record<string, string> = { completed: 'badge-green', 'in-progress': 'badge-blue', 'not-started': 'badge-gray', overdue: 'badge-red' }
const iconColors = ['#0891b2', '#059669', '#d97706', '#dc2626']

export default function NurseDash() {
  const { profile, navigate } = useApp()
  const [enrollments, setEnrollments] = useState({ assigned: 0, done: 0, overdue: 0, inprog: 0 })
  const [recentCourses, setRecentCourses] = useState<CourseSummary[]>([])
  const [recentCerts, setRecentCerts] = useState<CertSummary[]>([])
  const [notifs, setNotifs] = useState<NotifSummary[]>([])

  useEffect(() => {
    if (profile?.id) loadAll()
  }, [profile?.id])

  async function loadAll() {
    const profileId = profile!.id

    // Load enrollments with course details and lesson progress
    const [enrollRes, progressRes, certsRes, notifsRes] = await Promise.all([
      supabase
        .from('nurse_enrollments')
        .select('id,course_id,status,completion_pct,due_date,courses(title,category,duration,thumbnail_icon)')
        .eq('profile_id', profileId)
        .order('course_id'),
      supabase
        .from('lesson_progress')
        .select('course_key,completed')
        .eq('profile_id', profileId),
      supabase
        .from('certificates')
        .select('id,course_name,issued_at,expiry_date,status')
        .eq('profile_id', profileId)
        .order('issued_at', { ascending: false })
        .limit(3),
      supabase
        .from('notifications')
        .select('id,message,sent_at,read')
        .eq('profile_id', profileId)
        .order('sent_at', { ascending: false })
        .limit(4),
    ])

    const enrollData = enrollRes.data ?? []
    const progressData = progressRes.data ?? []

    // Build done-count per course
    const doneMap: Record<string, number> = {}
    for (const p of progressData) {
      if (p.completed) doneMap[p.course_key] = (doneMap[p.course_key] ?? 0) + 1
    }

    // Compute stats
    let done = 0, overdue = 0, inprog = 0
    const courseSummaries: CourseSummary[] = []

    for (const e of enrollData) {
      const c = e.courses as unknown as { title: string; category: string; duration: string; thumbnail_icon: string } | null
      const doneLessons = doneMap[e.course_id] ?? 0
      const pct = e.completion_pct ?? 0

      let displayStatus = e.status ?? 'not_started'
      if (doneLessons > 0) displayStatus = pct >= 100 ? 'completed' : 'in-progress'
      if (e.due_date && new Date(e.due_date) < new Date() && displayStatus !== 'completed') displayStatus = 'overdue'
      if (displayStatus === 'not_started') displayStatus = 'not-started'
      if (displayStatus === 'in_progress') displayStatus = 'in-progress'

      if (displayStatus === 'completed') done++
      else if (displayStatus === 'overdue') overdue++
      else if (displayStatus === 'in-progress') inprog++

      courseSummaries.push({
        courseId: e.course_id,
        title: c?.title ?? 'Course',
        category: c?.category ?? '',
        duration: c?.duration ?? '',
        thumbnail_icon: c?.thumbnail_icon ?? '📚',
        status: displayStatus,
        pct,
      })
    }

    setEnrollments({ assigned: enrollData.length, done, overdue, inprog })
    setRecentCourses(courseSummaries.slice(0, 4))
    setRecentCerts((certsRes.data ?? []) as CertSummary[])
    setNotifs((notifsRes.data ?? []) as NotifSummary[])
  }

  return (
    <div className="screen-container nurse-dash">
      <div className="nurse-welcome">
        <div className="nurse-welcome-text">
          <h1>Welcome back, <span>{profile?.full_name?.split(' ')[0]}</span> 👋</h1>
          <p>Continue your training progress</p>
        </div>
        <div className="nurse-welcome-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="nurse-kpi-grid">
        <div className="nurse-kpi-card" onClick={() => navigate('ncourses')}>
          <div className="nurse-kpi-icon" style={{ background: '#eff6ff' }}>📚</div>
          <div className="nurse-kpi-value">{enrollments.assigned}</div>
          <div className="nurse-kpi-label">Assigned Courses</div>
        </div>
        <div className="nurse-kpi-card" onClick={() => navigate('ncourses')}>
          <div className="nurse-kpi-icon" style={{ background: '#f0fdf4' }}>✅</div>
          <div className="nurse-kpi-value">{enrollments.done}</div>
          <div className="nurse-kpi-label">Completed</div>
        </div>
        <div className="nurse-kpi-card" onClick={() => navigate('ncourses')}>
          <div className="nurse-kpi-icon" style={{ background: '#fffbeb' }}>▶️</div>
          <div className="nurse-kpi-value">{enrollments.inprog}</div>
          <div className="nurse-kpi-label">In Progress</div>
        </div>
        <div className="nurse-kpi-card" style={{ borderColor: enrollments.overdue > 0 ? 'var(--red)' : undefined }}>
          <div className="nurse-kpi-icon" style={{ background: '#fef2f2' }}>⚠️</div>
          <div className="nurse-kpi-value" style={{ color: enrollments.overdue > 0 ? 'var(--red)' : undefined }}>{enrollments.overdue}</div>
          <div className="nurse-kpi-label">Overdue</div>
        </div>
      </div>

      <div className="nurse-dash-grid">
        <div className="card">
          <div className="card-header">
            <h3>My Courses</h3>
            <button className="btn btn-sm" onClick={() => navigate('ncourses')}>View All</button>
          </div>
          <div className="nurse-course-list">
            {recentCourses.length === 0 ? (
              <div className="empty-state">No courses assigned yet.</div>
            ) : recentCourses.map((c, i) => (
              <div key={c.courseId} className="nurse-course-row" onClick={() => navigate('ncourse', { courseId: c.courseId })}>
                <div
                  className="nurse-course-icon"
                  style={{ background: iconColors[i % 4] + '20', color: iconColors[i % 4] }}
                >
                  {c.thumbnail_icon}
                </div>
                <div className="nurse-course-info">
                  <div className="nurse-course-title">{c.title}</div>
                  <div className="nurse-course-meta">{c.duration}{c.category ? ` · ${c.category}` : ''}</div>
                  <div className="bar-track sm" style={{ marginTop: 4 }}>
                    <div
                      className="bar-fill"
                      style={{
                        width: `${c.pct}%`,
                        background: c.status === 'overdue' ? 'var(--red)' : c.status === 'completed' ? 'var(--green)' : 'var(--teal)',
                      }}
                    />
                  </div>
                </div>
                <span className={`badge ${statusColor[c.status] ?? 'badge-gray'}`}>{c.status.replace('-', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Certificates</h3>
            <button className="btn btn-sm" onClick={() => navigate('ncerts')}>View All</button>
          </div>
          {recentCerts.length === 0 ? (
            <div className="empty-state">No certificates yet</div>
          ) : recentCerts.map(cert => (
            <div key={cert.id} className="cert-mini-row">
              <div className="cert-mini-icon">🎓</div>
              <div className="cert-mini-info">
                <div className="cert-mini-title">{cert.course_name}</div>
                <div className="cert-mini-meta">
                  Issued: {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : '—'}
                  {cert.expiry_date ? ` · Expires: ${cert.expiry_date}` : ''}
                </div>
              </div>
              <span className={`badge ${cert.status === 'Valid' ? 'badge-green' : 'badge-red'}`}>{cert.status}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Notifications</h3>
            <button className="btn btn-sm" onClick={() => navigate('nnotifs')}>View All</button>
          </div>
          <div className="nurse-notif-list">
            {notifs.length === 0 ? (
              <div className="empty-state">No notifications</div>
            ) : notifs.map(n => (
              <div key={n.id} className={`nurse-notif-row${!n.read ? ' unread' : ''}`}>
                <div className="nurse-notif-dot" style={{ opacity: n.read ? 0 : 1 }} />
                <div className="nurse-notif-msg">{n.message}</div>
                <div className="nurse-notif-time">{new Date(n.sent_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>My Progress Overview</h3></div>
          <div className="nurse-progress-overview">
            <div className="donut-wrap">
              <svg viewBox="0 0 100 100" className="donut-svg">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--teal)" strokeWidth="12"
                  strokeDasharray={`${(enrollments.done / Math.max(enrollments.assigned, 1)) * 251.3} 251.3`}
                  strokeDashoffset="62.8" strokeLinecap="round" />
              </svg>
              <div className="donut-label">
                <div className="donut-value">{enrollments.assigned > 0 ? Math.round((enrollments.done / enrollments.assigned) * 100) : 0}%</div>
                <div className="donut-sub">Complete</div>
              </div>
            </div>
            <div className="nurse-progress-stats">
              <div className="np-stat"><span>Completed</span><strong>{enrollments.done}</strong></div>
              <div className="np-stat"><span>In Progress</span><strong>{enrollments.inprog}</strong></div>
              <div className="np-stat"><span>Not Started</span><strong>{Math.max(0, enrollments.assigned - enrollments.done - enrollments.inprog - enrollments.overdue)}</strong></div>
              <div className="np-stat" style={{ color: 'var(--red)' }}><span>Overdue</span><strong>{enrollments.overdue}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
