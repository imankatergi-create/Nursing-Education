import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { COURSES, CERTS, NOTIFS } from '../../data/constants'

export default function NurseDash() {
  const { profile, navigate } = useApp()
  const [enrollments, setEnrollments] = useState({ assigned: 6, done: 4, overdue: 1, inprog: 1 })

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('nurse_enrollments').select('*').eq('profile_id', profile?.id ?? '')
      if (data && data.length > 0) {
        const done = data.filter((e: { status: string }) => e.status === 'completed').length
        const overdue = data.filter((e: { status: string }) => e.status === 'overdue').length
        const inprog = data.filter((e: { status: string }) => e.status === 'in_progress').length
        setEnrollments({ assigned: data.length, done, overdue, inprog })
      }
    })()
  }, [profile?.id])

  const recentCerts = CERTS.slice(0, 2)

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
            {COURSES.slice(0,4).map((c, i) => {
              const statuses = ['in-progress','completed','not-started','overdue']
              const pcts = [65, 100, 0, 20]
              const status = statuses[i % statuses.length]
              return (
                <div key={c.id} className="nurse-course-row" onClick={() => navigate('ncourse', { courseId: c.id })}>
                  <div className="nurse-course-icon" style={{ background: ['#0891b2','#059669','#d97706','#dc2626'][i % 4] + '20', color: ['#0891b2','#059669','#d97706','#dc2626'][i % 4] }}>
                    {c.thumbnail_icon || '📚'}
                  </div>
                  <div className="nurse-course-info">
                    <div className="nurse-course-title">{c.title}</div>
                    <div className="nurse-course-meta">{c.duration} · {c.category}</div>
                    <div className="bar-track sm" style={{ marginTop: 4 }}>
                      <div className="bar-fill" style={{ width: `${pcts[i]}%`, background: status === 'overdue' ? 'var(--red)' : status === 'completed' ? 'var(--green)' : 'var(--teal)' }} />
                    </div>
                  </div>
                  <span className={`badge ${status === 'completed' ? 'badge-green' : status === 'overdue' ? 'badge-red' : status === 'in-progress' ? 'badge-blue' : 'badge-gray'}`}>{status}</span>
                </div>
              )
            })}
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
              <span className={`badge ${cert.status === 'valid' ? 'badge-green' : 'badge-red'}`}>{cert.status}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Notifications</h3>
            <button className="btn btn-sm" onClick={() => navigate('nnotifs')}>View All</button>
          </div>
          <div className="nurse-notif-list">
            {NOTIFS.slice(0,4).map(n => (
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
              <div className="np-stat"><span>Not Started</span><strong>{enrollments.assigned - enrollments.done - enrollments.inprog - enrollments.overdue}</strong></div>
              <div className="np-stat" style={{ color:'var(--red)' }}><span>Overdue</span><strong>{enrollments.overdue}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
