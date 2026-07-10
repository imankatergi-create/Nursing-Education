import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import type { Notification, Announcement } from '../../types'

type Tab = 'notifications' | 'announcements'

function getNotifIcon(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('deadline') || t.includes('due')) return '⏰'
  if (t.includes('assign') || t.includes('enroll')) return '📚'
  if (t.includes('cert') || t.includes('complet') || t.includes('pass')) return '🎓'
  if (t.includes('quiz') || t.includes('exam') || t.includes('score')) return '📝'
  if (t.includes('material') || t.includes('document') || t.includes('policy')) return '📄'
  if (t.includes('announc')) return '📣'
  if (t.includes('reminder')) return '🔔'
  if (t.includes('system')) return '⚙️'
  return '🔔'
}

const priorityColor: Record<string, string> = { urgent: 'badge-red', high: 'badge-amber', normal: 'badge-blue', low: 'badge-gray' }

export default function NurseNotifs() {
  const { profile } = useApp()
  const [tab, setTab] = useState<Tab>('notifications')
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'unread'>('all')

  useEffect(() => {
    if (!profile?.id) return
    fetchNotifs()
    fetchAnnouncements()
  }, [profile?.id])

  async function fetchNotifs() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', profile!.id)
      .order('sent_at', { ascending: false })
    setNotifs(data ?? [])
    setLoading(false)
  }

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('start_date', { ascending: false })
    setAnnouncements(data ?? [])
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true })
      .eq('profile_id', profile!.id)
      .eq('read', false)
    setNotifs(ns => ns.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const filtered = filter === 'all' ? notifs : notifs.filter(n => !n.read)

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">
            {tab === 'notifications' ? 'Notifications' : 'Announcements'}
          </h1>
          <p className="screen-subtitle">
            {tab === 'notifications'
              ? `${unreadCount} unread`
              : `${announcements.length} active announcements`}
          </p>
        </div>
        {tab === 'notifications' && (
          <button className="btn btn-outline" onClick={markAllRead} disabled={unreadCount === 0}>
            Mark All Read
          </button>
        )}
      </div>

      <div className="tab-row">
        <button className={`tab-btn${tab === 'notifications' ? ' active' : ''}`} onClick={() => setTab('notifications')}>
          Notifications
          {unreadCount > 0 && <span className="tab-count">{unreadCount}</span>}
        </button>
        <button className={`tab-btn${tab === 'announcements' ? ' active' : ''}`} onClick={() => setTab('announcements')}>
          Announcements
          <span className="tab-count">{announcements.length}</span>
        </button>
      </div>

      {tab === 'notifications' && (
        <>
          <div className="tab-row" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
            {(['all','unread'] as const).map(t => (
              <button key={t} className={`tab-btn${filter === t ? ' active' : ''}`} onClick={() => setFilter(t)}
                style={{ fontSize: 13 }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                <span className="tab-count">{t === 'all' ? notifs.length : unreadCount}</span>
              </button>
            ))}
          </div>
          <div className="notif-list">
            {loading ? <div className="loading-state">Loading…</div> : filtered.map(n => (
              <div
                key={n.id}
                className={`notif-full-item${!n.read ? ' unread' : ''}`}
                onClick={() => !n.read && markRead(n.id)}
              >
                <div className="notif-full-icon">{getNotifIcon(n.type)}</div>
                <div className="notif-full-body">
                  <div className="notif-full-message">{n.message}</div>
                  <div className="notif-full-meta">
                    <span>{n.type}</span>
                    <span>·</span>
                    <span>{n.channels}</span>
                    <span>·</span>
                    <span>{new Date(n.sent_at).toLocaleString()}</span>
                  </div>
                </div>
                {!n.read && <div className="notif-unread-dot" />}
              </div>
            ))}
            {!loading && filtered.length === 0 && (
              <div className="empty-state">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'announcements' && (
        <div className="announcements-list">
          {announcements.length === 0 ? (
            <div className="empty-state">No announcements</div>
          ) : announcements.map(a => (
            <div key={a.id} className="announcement-card">
              <div className="announcement-header">
                <div>
                  <h3 className="announcement-title">{a.title}</h3>
                  <div className="announcement-meta">
                    <span className={`badge ${priorityColor[a.priority.toLowerCase()] ?? 'badge-gray'}`}>
                      {a.priority}
                    </span>
                    <span className="announcement-audience">{a.audience_type}</span>
                    <span>{a.start_date} – {a.end_date}</span>
                  </div>
                </div>
                <div className="announcement-stats">
                  {a.require_confirmation && <span className="tag tag-amber">Action Required</span>}
                  {a.send_email && <span className="tag tag-blue">Email</span>}
                </div>
              </div>
              <p className="announcement-body">{a.body}</p>
              {a.attachment_name && (
                <div className="announcement-attach">📎 {a.attachment_name}</div>
              )}
              <div className="announcement-footer">By {a.created_by}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
