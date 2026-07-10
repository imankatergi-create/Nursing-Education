import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Course, Program } from '../types'

export default function ProgramsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [programs, setPrograms] = useState<Program[]>([])
  const [programCourses, setProgramCourses] = useState<Record<string, Course[]>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all'|'active'|'draft'>('all')

  useEffect(() => { fetchPrograms() }, [])

  async function fetchPrograms() {
    setLoading(true)
    const { data: progs } = await supabase.from('programs').select('*').order('title')
    const list = progs ?? []
    setPrograms(list)
    if (list.length > 0) {
      const { data: pc } = await supabase
        .from('programs_courses')
        .select('program_id, course_id, courses(*)')
        .in('program_id', list.map(p => p.id))
      const map: Record<string, Course[]> = {}
      for (const row of (pc ?? [])) {
        const r = row as any
        if (!map[r.program_id]) map[r.program_id] = []
        if (r.courses) map[r.program_id].push(r.courses)
      }
      setProgramCourses(map)
    }
    setLoading(false)
  }

  const filtered = programs.filter(p => tab === 'all' || p.status === tab)
  const statusColor: Record<string, string> = { active: 'badge-green', draft: 'badge-amber', archived: 'badge-gray' }

  function openAdd() {
    openModal({ title: 'Create Program', wide: true,
      body: <ProgramForm onSave={async d => {
        await supabase.from('programs').insert(d)
        fetchPrograms(); closeModal(); toast('Program created')
      }} />
    })
  }

  function openEdit(p: Program) {
    openModal({ title: 'Edit Program', wide: true,
      body: <ProgramForm initial={p} onSave={async d => {
        await supabase.from('programs').update(d).eq('id', p.id)
        fetchPrograms(); closeModal(); toast('Program updated')
      }} />
    })
  }

  function openManageCourses(p: Program) {
    openModal({ title: `Courses — ${p.title}`, wide: true,
      body: <CourseManager
        programId={p.id}
        current={programCourses[p.id] ?? []}
        onDone={() => { fetchPrograms(); closeModal() }}
      />
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
        {loading ? <div className="loading-state">Loading…</div> : filtered.map(p => {
          const courses = programCourses[p.id] ?? []
          return (
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
              {courses.length > 0 && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Courses ({courses.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {courses.slice(0, 3).map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--muted)' }}>📚</span>
                        <span style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>{c.code}</span>
                      </div>
                    ))}
                    {courses.length > 3 && (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>+{courses.length - 3} more</div>
                    )}
                  </div>
                </div>
              )}
              <div className="program-actions">
                <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-sm btn-outline" onClick={() => openManageCourses(p)}>
                  Courses{courses.length > 0 ? ` (${courses.length})` : ''}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteProgram(p)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CourseManager({ programId, current, onDone }: { programId: string; current: Course[]; onDone: () => void }) {
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(current.map(c => c.id)))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('courses').select('*').order('title').then(({ data }) => setAllCourses(data ?? []))
  }, [])

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function save() {
    setSaving(true)
    await supabase.from('programs_courses').delete().eq('program_id', programId)
    if (selected.size > 0) {
      await supabase.from('programs_courses').insert(
        Array.from(selected).map((cid, i) => ({ program_id: programId, course_id: cid, order_index: i }))
      )
    }
    setSaving(false)
    onDone()
  }

  const statusColor: Record<string, string> = { active: 'badge-green', draft: 'badge-amber', archived: 'badge-gray' }

  return (
    <div>
      <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>Select the courses that belong to this program.</p>
      {allCourses.length === 0 ? (
        <div className="empty-state">No courses created yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', marginBottom: 16 }}>
          {allCourses.map(c => (
            <label key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px',
              border: `1.5px solid ${selected.has(c.id) ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 8, cursor: 'pointer',
              background: selected.has(c.id) ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : '',
              transition: 'border-color 0.15s, background 0.15s',
            }}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span style={{ fontSize: 20 }}>{c.thumbnail_icon || '📚'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.code} · {c.category} · {c.duration}</div>
              </div>
              <span className={`badge ${statusColor[c.status] ?? 'badge-gray'}`}>{c.status}</span>
            </label>
          ))}
        </div>
      )}
      <div className="modal-form-actions">
        <span style={{ color: 'var(--muted)', fontSize: 13, marginRight: 'auto' }}>
          {selected.size} course{selected.size !== 1 ? 's' : ''} selected
        </span>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Courses'}
        </button>
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
          <label><input type="checkbox" checked={!!form.certificate_enabled} onChange={e => set('certificate_enabled', e.target.checked)} /> Certificate Enabled</label>
        </div>
      </div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  )
}
