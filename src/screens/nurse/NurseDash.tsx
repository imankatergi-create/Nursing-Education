import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import type { Course, Certificate, Notification } from '../../types'

export default function NurseDash() {
  const { profile, navigate } = useApp()
  const [enrollments, setEnrollments] = useState({ assigned: 0, done: 0, overdue: 0, inprog: 0 })
  const [recentCourses, setRecentCourses] = useState<Course[]>([])
  const [recentCerts, setRecentCerts] = useState<Certificate[]>([])
  const [recentNotifs, setRecentNotifs] = useState<Notification[]>([])

  useEffect(() => {
    if (!profile?.id) return
    ;(async () => {
      const [{ data: enroll }, { data: courses }, { data: certs }, { data: notifs }] = await Promise.all([
        supabase.from('nurse_enrollments').select('status,due_date').eq('profile_id', profile.id),
        supabase.from('courses').select('*').order('title').limit(4),
        supabase.from('certificates').select('*').eq('profile_id', profile.id).order('issued_at', { ascending: false }).limit(2),
        supabase.from('notifications').select('*').eq('profile_id', profile.id).order('sent_at', { ascending: false }).limit(4),
      ])
      if (enroll) {
        const now = new Date()
        const done = enroll.filter(e => e.status === 'completed').length
        const overdue = enroll.filter(e => e.due_date && new Date(e.due_date) < now && e.status !== 'completed').length
        const inprog = enroll.filter(e => e.status === 'in_progress').length
        setEnrollments({ assigned: enroll.length, done, overdue, inprog })
      }
      setRecentCourses(courses ?? [])
      setRecentCerts(certs ?? [])
      setRecentNotifs(notifs ?? [])
    })()
  }, [profile?.id])

  const thumbColors = ['#0891b2','#059669','#d97706','#dc2626']

  return (
    <div className="screen-container nurse-dash">
      <div className="nurse-welcome">
        <div className="nurse-welcome-text">
          <h1>Welcome back, <span>{profile?.full_name?.split(' ')[0]}</span> 👋</h1>
          <p>Continue your training progress</p>
        </div>
        <div className="nurse-welcome-date">{new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
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
              <div className="empty-state">No courses yet</div>
            ) : recentCourses.map((c, i) => (
              <div key={c.id} className="nurse-course-row" onClick={() => navigate('ncourse', { courseId: c.id })}>
                <div className="nurse-course-icon" style={{ background: thumbColors[i % 4] + '20', color: thumbColors[i % 4] }}>
                  {c.thumbnail_icon || '📚'}
                </div>
                <div className="nurse-course-info">
                  <div className="nurse-course-title">{c.title}</div>
                  <div className="nurse-course-meta">{c.duration} · {c.category}</div>
                </div>
                <span className="badge badge-gray">{c.status}</span>
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
                <div className="cert-mini-meta">Issued: {cert.issued_at} · Expires: {cert.expiry_date}</div>
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
            {recentNotifs.length === 0 ? (
              <div className="empty-state">No notifications</div>
            ) : recentNotifs.map(n => (
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
              <div className="np-stat" style={{ color:'var(--red)' }}><span>Overdue</span><strong>{enrollments.overdue}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
