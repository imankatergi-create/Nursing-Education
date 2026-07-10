import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { PROGRAMS } from '../data/constants'
import type { Program } from '../types'

export default function ProgramsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all'|'active'|'draft'>('all')

  useEffect(() => { fetchPrograms() }, [])

  async function fetchPrograms() {
    setLoading(true)
    const { data } = await supabase.from('programs').select('*').order('title')
    if (data && data.length > 0) setPrograms(data)
    else setPrograms(PROGRAMS)
    setLoading(false)
  }

  const filtered = programs.filter(p => tab === 'all' || p.status === tab)

  const statusColor: Record<string, string> = { active: 'badge-green', draft: 'badge-amber', archived: 'badge-gray' }

  function openAdd() {
    openModal({ title: 'Create Program', wide: true,
      body: <ProgramForm onSave={async d => { await supabase.from('programs').insert(d); fetchPrograms(); closeModal(); toast('Program created') }} />
    })
  }

  function openEdit(p: Program) {
    openModal({ title: 'Edit Program', wide: true,
      body: <ProgramForm initial={p} onSave={async d => { await supabase.from('programs').update(d).eq('id', p.id); fetchPrograms(); closeModal(); toast('Program updated') }} />
    })
  }

  async function deleteProgram(p: Program) {
    if (!confirm(`Delete program "${p.title}"? This cannot be undone.`)) return
    await supabase.from('programs').delete().eq('id', p.id)
    fetchPrograms()
    toast('Program deleted')
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Programs</h1>
          <p className="screen-subtitle">{programs.length} training programs</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Create Program</button>
      </div>

      <div className="tab-row">
        {(['all','active','draft'] as const).map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="tab-count">{t === 'all' ? programs.length : programs.filter(p => p.status === t).length}</span>
          </button>
        ))}
      </div>

      <div className="programs-grid">
        {loading ? <div className="loading-state">Loading…</div> : filtered.map(p => (
          <div key={p.id} className="program-card">
            <div className="program-card-header">
              <div>
                <div className="program-code">{p.code}</div>
                <h3 className="program-title">{p.title}</h3>
              </div>
              <span className={`badge ${statusColor[p.status] ?? 'badge-gray'}`}>{p.status}</span>
            </div>
            <div className="program-meta">
              <span>📅 {p.start_date} – {p.end_date}</span>
              <span>⏱ {p.duration}</span>
              <span>🎯 {p.audience}</span>
            </div>
            <p className="program-objectives">{p.objectives}</p>
            <div className="program-tags">
              <span className="tag">{p.category}</span>
              {p.mandatory && <span className="tag tag-red">Mandatory</span>}
              {p.certificate_enabled && <span className="tag tag-blue">Certificate</span>}
            </div>
            <div className="program-actions">
              <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
              <button className="btn btn-sm btn-outline">View Assignments</button>
              <button className="btn btn-sm btn-danger" onClick={() => deleteProgram(p)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgramForm({ initial, onSave }: { initial?: Partial<Program>; onSave: (d: Partial<Program>) => void }) {
  const [form, setForm] = useState({
    title: '', code: '', category: 'Clinical', objectives: '', outcomes: '', audience: 'All Nurses',
    mandatory: false, start_date: '', end_date: '', duration: '', pass_requirements: '',
    certificate_enabled: false, status: 'draft', ...initial
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-row">
        <div className="form-group"><label>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
        <div className="form-group"><label>Code</label><input value={form.code} onChange={e => set('code', e.target.value)} required /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {['Clinical','Safety','Compliance','Leadership','Technical'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Audience</label><input value={form.audience} onChange={e => set('audience', e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Objectives</label><textarea rows={2} value={form.objectives} onChange={e => set('objectives', e.target.value)} /></div>
      <div className="form-row">
        <div className="form-group"><label>Start Date</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
        <div className="form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
        <div className="form-group"><label>Duration</label><input value={form.duration} onChange={e => set('duration', e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
          </select>
        </div>
        <div className="form-group checkbox-group" style={{ alignSelf:'flex-end' }}>
          <label><input type="checkbox" checked={!!form.mandatory} onChange={e => set('mandatory', e.target.checked)} /> Mandatory</label>
          <label><input type="checkbox" checked={!!form.certificate_enabled} onChange={e => set('certificate_enabled', e.target.checked)} /> Certificate</label>
        </div>
      </div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  )
}
