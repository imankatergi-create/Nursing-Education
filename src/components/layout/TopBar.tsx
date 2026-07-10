import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

interface NotifRow { id: string; message: string; type: string; sent_at: string; read: boolean }

export default function TopBar({ isNursePortal, onBurger }: { isNursePortal: boolean; onBurger: () => void }) {
  const { profile, role, navigate, screen, toast, openModal, closeModal } = useApp()
  const [search, setSearch] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotifRow[]>([])
  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  const screenLabel: Record<string, string> = {
    dashboard: 'Dashboard', users: 'Users', roles: 'Roles & Permissions', depts: 'Departments',
    programs: 'Programs', courses: 'Courses', syllabus: 'Syllabus', materials: 'Materials',
    quizzes: 'Quizzes', assignments: 'Assignments', progress: 'Progress', reports: 'Reports',
    notifications: 'Notifications', announcements: 'Announcements', certificates: 'Certificates',
    feedback: 'Feedback', audit: 'Audit Log', settings: 'Settings', coverage: 'Coverage Map',
    cmssearch: 'Search', ndash: 'My Dashboard', ncourses: 'My Courses', ncourse: 'Course',
    ncerts: 'My Certificates', nnotifs: 'Notifications', nsearch: 'Search',
  }

  useEffect(() => {
    if (!profile) return
    supabase.from('notifications')
      .select('id,message,type,sent_at,read')
      .eq('profile_id', profile.id)
      .order('sent_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setNotifs(data ?? []))
  }, [profile?.id])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    toast('Signed out')
  }

  async function markAllRead() {
    if (!profile) return
    await supabase.from('notifications').update({ read: true }).eq('profile_id', profile.id)
    setNotifs(n => n.map(x => ({ ...x, read: true })))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!search.trim()) return
    navigate(isNursePortal ? 'nsearch' : 'cmssearch', { q: search })
    setSearch('')
  }

  function openChangePassword() {
    setUserMenuOpen(false)
    openModal({
      title: 'Change Password',
      body: <ChangePasswordForm onDone={() => { closeModal(); toast('Password updated') }} />,
    })
  }

  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="burger-btn" onClick={onBurger} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <h2 className="page-title">{screenLabel[screen] ?? 'Dashboard'}</h2>
      </div>
      <div className="topbar-center">
        <form onSubmit={handleSearch} className="topbar-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder={isNursePortal ? 'Search courses…' : 'Search courses, users, programs…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </form>
      </div>
      <div className="topbar-right">

        {/* Notification bell */}
        <div className="topbar-notif" ref={notifRef} onClick={() => setNotifOpen(!notifOpen)}>
          <span>🔔</span>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          {notifOpen && (
            <div className="notif-dropdown" onClick={e => e.stopPropagation()}>
              <div className="notif-header">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>
                )}
              </div>
              {notifs.length === 0 ? (
                <div className="notif-empty">No notifications</div>
              ) : notifs.map(n => (
                <div key={n.id} className={`notif-item${n.read ? '' : ' unread'}`}>
                  {!n.read && <div className="notif-dot" />}
                  {n.read && <div className="notif-dot" style={{ opacity: 0 }} />}
                  <div>
                    <div className="notif-title">{n.message}</div>
                    <div className="notif-time">{new Date(n.sent_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
              <button
                className="notif-view-all"
                onClick={() => { navigate(isNursePortal ? 'nnotifs' : 'notifications'); setNotifOpen(false) }}
              >
                View all
              </button>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="topbar-avatar-wrap" ref={userRef} style={{ cursor: 'pointer' }} onClick={() => setUserMenuOpen(!userMenuOpen)}>
          <div className="topbar-avatar">{profile?.full_name?.[0] ?? '?'}</div>
          <div className="topbar-user-info">
            <span className="topbar-user-name">{profile?.full_name}</span>
            <span className="topbar-user-role">{role}</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>▼</span>
          {userMenuOpen && (
            <div className="user-dropdown" onClick={e => e.stopPropagation()}>
              <div className="user-dropdown-header">
                <div className="user-dropdown-name">{profile?.full_name}</div>
                <div className="user-dropdown-email">{profile?.email}</div>
                <span className="badge badge-teal" style={{ marginTop: 4 }}>{role}</span>
              </div>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item" onClick={openChangePassword}>🔑 Change Password</button>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item danger" onClick={handleSignOut}>⏻ Sign Out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { profile } = useApp()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) { setError('Password must be at least 8 characters'); return }
    if (next !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)

    // Verify current password first
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: profile!.email!,
      password: current,
    })
    if (verifyErr) { setError('Current password is incorrect'); setLoading(false); return }

    const { data: fnData, error: fnErr } = await supabase.functions.invoke('admin-users', {
      body: { action: 'change_password', user_id: profile!.id, new_password: next },
    })
    if (fnErr || fnData?.error) {
      setError(fnData?.error ?? fnErr?.message ?? 'Failed to update password')
      setLoading(false)
      return
    }
    onDone()
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Current Password</label>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required placeholder="Your current password" />
      </div>
      <div className="form-group">
        <label>New Password</label>
        <input type="password" value={next} onChange={e => setNext(e.target.value)} required placeholder="Min 8 characters" />
      </div>
      <div className="form-group">
        <label>Confirm New Password</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Repeat new password" />
      </div>
      {error && <div className="login-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </form>
  )
}
