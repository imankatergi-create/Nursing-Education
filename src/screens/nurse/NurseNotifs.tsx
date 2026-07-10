import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import type { Notification } from '../../types'

export default function NurseNotifs() {
  const { profile } = useApp()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'unread'>('all')

  useEffect(() => { fetchNotifs() }, [profile?.id])

  async function fetchNotifs() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
    setNotifs(data ?? [])
    setLoading(false)
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    setNotifs(ns => ns.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const filtered = filter === 'all' ? notifs : notifs.filter(n => !n.read)

  const typeIcon: Record<string, string> = {
    'course_assignment': '📚', 'deadline': '⏰', 'certificate': '🎓', 'system': '⚙️',
    'announcement': '📣', 'reminder': '🔔', 'completion': '✅',
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Notifications</h1>
          <p className="screen-subtitle">{unreadCount} unread</p>
        </div>
        <button className="btn btn-outline" onClick={markAllRead} disabled={unreadCount === 0}>Mark All Read</button>
      </div>

      <div className="tab-row">
        {(['all','unread'] as const).map(t => (
          <button key={t} className={`tab-btn${filter === t ? ' active' : ''}`} onClick={() => setFilter(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="tab-count">{t === 'all' ? notifs.length : unreadCount}</span>
          </button>
        ))}
      </div>

      <div className="notif-list">
        {loading ? <div className="loading-state">Loading…</div> : filtered.map(n => (
          <div key={n.id} className={`notif-full-item${!n.read ? ' unread' : ''}`} onClick={() => !n.read && markRead(n.id)}>
            <div className="notif-full-icon">{typeIcon[n.type] ?? '🔔'}</div>
            <div className="notif-full-body">
              <div className="notif-full-message">{n.message}</div>
              <div className="notif-full-meta">
                <span>{n.channels}</span>
                <span>·</span>
                <span>{new Date(n.sent_at).toLocaleString()}</span>
              </div>
            </div>
            {!n.read && <div className="notif-unread-dot" />}
          </div>
        ))}
        {!loading && filtered.length === 0 && <div className="empty-state">No notifications</div>}
      </div>
    </div>
  )
}
