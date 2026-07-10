import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { ANNOUNCEMENTS } from '../data/constants'
import type { Announcement } from '../types'

export default function AnnouncementsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAnnouncements() }, [])

  async function fetchAnnouncements() {
    setLoading(true)
    const { data } = await supabase.from('announcements').select('*').order('start_date', { ascending: false })
    if (data && data.length > 0) setAnnouncements(data)
    else setAnnouncements(ANNOUNCEMENTS)
    setLoading(false)
  }

  const priorityColor: Record<string, string> = { urgent: 'badge-red', high: 'badge-amber', normal: 'badge-blue', low: 'badge-gray' }

  function openCreate() {
    openModal({ title: 'Create Announcement', wide: true,
      body: <AnnouncementForm onSave={async d => { await supabase.from('announcements').insert(d); fetchAnnouncements(); closeModal(); toast('Announcement published') }} />
    })
  }

  function openEdit(a: Announcement) {
    openModal({ title: 'Edit Announcement', wide: true,
      body: <AnnouncementForm initial={a} onSave={async d => { await supabase.from('announcements').update(d).eq('id', a.id); fetchAnnouncements(); closeModal(); toast('Announcement updated') }} />
    })
  }

  async function deleteAnnouncement(a: Announcement) {
    if (!confirm(`Delete announcement "${a.title}"?`)) return
    await supabase.from('announcements').delete().eq('id', a.id)
    fetchAnnouncements()
    toast('Announcement deleted')
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Announcements</h1>
          <p className="screen-subtitle">{announcements.length} announcements</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Announcement</button>
      </div>

      <div className="announcements-list">
        {loading ? <div className="loading-state">Loading…</div> : announcements.map(a => (
          <div key={a.id} className="announcement-card">
            <div className="announcement-header">
              <div>
                <h3 className="announcement-title">{a.title}</h3>
                <div className="announcement-meta">
                  <span className={`badge ${priorityColor[a.priority] ?? 'badge-gray'}`}>{a.priority}</span>
                  <span className="announcement-audience">{a.audience_type}</span>
                  <span>{a.start_date} – {a.end_date}</span>
                </div>
              </div>
              <div className="announcement-stats">
                <span className="stat-chip"><strong>{a.sent_count}</strong> sent</span>
                {a.require_confirmation && <span className="tag tag-amber">Confirmation Required</span>}
                {a.send_email && <span className="tag tag-blue">Email</span>}
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(a)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteAnnouncement(a)}>Delete</button>
              </div>
            </div>
            <p className="announcement-body">{a.body}</p>
            {a.attachment_name && <div className="announcement-attach">📎 {a.attachment_name}</div>}
            <div className="announcement-footer">By {a.created_by}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnnouncementForm({ initial, onSave }: { initial?: Partial<Announcement>; onSave: (d: Partial<Announcement>) => void }) {
  const [form, setForm] = useState({
    title: '', body: '', audience_type: 'All Nurses', priority: 'normal',
    start_date: '', end_date: '', send_email: false, require_confirmation: false,
    sent_count: 0, created_by: 'Admin',
    ...initial,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-group"><label>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
      <div className="form-group"><label>Body</label><textarea rows={4} value={form.body} onChange={e => set('body', e.target.value)} required /></div>
      <div className="form-row">
        <div className="form-group"><label>Audience</label>
          <select value={form.audience_type} onChange={e => set('audience_type', e.target.value)}>
            <option>All Nurses</option><option>Department</option><option>Unit</option><option>Role</option>
          </select>
        </div>
        <div className="form-group"><label>Priority</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)}>
            <option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Start Date</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
        <div className="form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-group checkbox-group">
          <label><input type="checkbox" checked={form.send_email} onChange={e => set('send_email', e.target.checked)} /> Send Email</label>
          <label><input type="checkbox" checked={form.require_confirmation} onChange={e => set('require_confirmation', e.target.checked)} /> Require Confirmation</label>
        </div>
      </div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Publish'}</button></div>
    </form>
  )
}
