import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Notification } from '../types'

export default function NotificationsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'unread'>('all')

  useEffect(() => { fetchNotifs() }, [])

  async function fetchNotifs() {
    setLoading(true)
    const { data } = await supabase.from('notifications').select('*').order('sent_at', { ascending: false })
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
    toast('All marked as read')
  }

  async function deleteNotif(id: string) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(ns => ns.filter(n => n.id !== id))
    toast('Notification deleted')
  }

  const filtered = filter === 'all' ? notifs : notifs.filter(n => !n.read)
  const unreadCount = notifs.filter(n => !n.read).length

  const typeIcon: Record<string, string> = {
    'course_assignment': '📚', 'deadline': '⏰', 'certificate': '🎓', 'system': '⚙️',
    'announcement': '📣', 'reminder': '🔔', 'completion': '✅',
  }

  function openSend() {
    openModal({ title: 'Send Notification', wide: true,
      body: <SendForm onSave={async d => {
        await supabase.from('notifications').insert(d)
        fetchNotifs(); closeModal(); toast('Notification sent')
      }} />
    })
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Notifications</h1>
          <p className="screen-subtitle">{unreadCount} unread notifications</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline" onClick={markAllRead}>Mark All Read</button>
          <button className="btn btn-primary" onClick={openSend}>+ Send Notification</button>
        </div>
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
                <span>{n.recipient_name}</span>
                <span>·</span>
                <span>{n.channels}</span>
                <span>·</span>
                <span>{new Date(n.sent_at).toLocaleString()}</span>
              </div>
            </div>
            {!n.read && <div className="notif-unread-dot" />}
            <button
              className="btn btn-sm btn-danger"
              style={{ flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); deleteNotif(n.id) }}
            >Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SendForm({ onSave }: { onSave: (d: Partial<Notification>) => void }) {
  const [form, setForm] = useState({ type: 'system', message: '', channels: 'In-App', recipient_name: 'All Nurses', read: false, sent_at: new Date().toISOString() })
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-group"><label>Message</label><textarea rows={3} value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} required /></div>
      <div className="form-row">
        <div className="form-group"><label>Type</label>
          <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
            {['system','course_assignment','deadline','certificate','announcement','reminder'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Channels</label>
          <select value={form.channels} onChange={e => setForm(f => ({...f, channels: e.target.value}))}>
            <option>In-App</option><option>Email</option><option>SMS</option><option>In-App, Email</option><option>All</option>
          </select>
        </div>
      </div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Send</button></div>
    </form>
  )
}
