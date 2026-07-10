import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { PROGRAMS } from '../data/constants'
import type { Program, Course } from '../types'

export default function ProgramsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [programs, setPrograms] = useState<Program[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [programCourseMap, setProgramCourseMap] = useState<Record<string, Course[]>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'active' | 'draft'>('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: progs }, { data: courses }, { data: pcLinks }] = await Promise.all([
      supabase.from('programs').select('*').order('title'),
      supabase.from('courses').select('id,title,code,category,duration,level,mandatory,status').order('title'),
      supabase.from('program_courses').select('program_id,course_id,order_index').order('order_index'),
    ])

    const progList = (progs && progs.length > 0) ? progs as Program[] : PROGRAMS
    const courseList = (courses ?? []) as Course[]
    setPrograms(progList)
    setAllCourses(courseList)

    // Build map: programId → courses
    const map: Record<string, Course[]> = {}
    for (const link of pcLinks ?? []) {
      const course = courseList.find(c => c.id === link.course_id)
      if (course) {
        if (!map[link.program_id]) map[link.program_id] = []
        map[link.program_id].push(course)
      }
    }
    setProgramCourseMap(map)
    setLoading(false)
  }

  const filtered = programs.filter(p => tab === 'all' || p.status === tab)
  const statusColor: Record<string, string> = { active: 'badge-green', draft: 'badge-amber', archived: 'badge-gray' }

  function openAdd() {
    openModal({
      title: 'Create Program', wide: true,
      body: <ProgramForm onSave={async d => { await supabase.from('programs').insert(d); fetchAll(); closeModal(); toast('Program created') }} />,
    })
  }

  function openEdit(p: Program) {
    openModal({
      title: 'Edit Program', wide: true,
      body: <ProgramForm initial={p} onSave={async d => { await supabase.from('programs').update(d).eq('id', p.id); fetchAll(); closeModal(); toast('Program updated') }} />,
    })
  }

  function openManageCourses(p: Program) {
    const currentIds = (programCourseMap[p.id] ?? []).map(c => c.id)
    openModal({
      title: `Courses in "${p.title}"`,
      wide: true,
      body: (
        <CoursePicker
          allCourses={allCourses}
          selectedIds={currentIds}
          onSave={async (newIds) => {
            // Remove all then re-insert
            await supabase.from('program_courses').delete().eq('program_id', p.id)
            if (newIds.length > 0) {
              await supabase.from('program_courses').insert(
                newIds.map((courseId, i) => ({ program_id: p.id, course_id: courseId, order_index: i + 1 }))
              )
            }
            fetchAll(); closeModal()
            toast(`${newIds.length} course${newIds.length !== 1 ? 's' : ''} assigned to program`)
          }}
        />
      ),
    })
  }

  async function deleteProgram(p: Program) {
    if (!confirm(`Delete program "${p.title}"? This cannot be undone.`)) return
    await supabase.from('programs').delete().eq('id', p.id)
    fetchAll()
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
        {(['all', 'active', 'draft'] as const).map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="tab-count">{t === 'all' ? programs.length : programs.filter(p => p.status === t).length}</span>
          </button>
        ))}
      </div>

      <div className="programs-grid">
        {loading ? <div className="loading-state">Loading…</div> : filtered.map(p => {
          const linkedCourses = programCourseMap[p.id] ?? []
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

              {/* Linked courses preview */}
              <div style={{ marginTop: 10 }}>
                {linkedCourses.length > 0 ? (
                  <div>
                    <div className="program-course-count">📚 {linkedCourses.length} course{linkedCourses.length !== 1 ? 's' : ''} linked</div>
                    <div className="program-courses-list" style={{ marginTop: 6 }}>
                      {linkedCourses.slice(0, 3).map(c => (
                        <div key={c.id} className="program-course-row">
                          <span>{c.title}</span>
                          <span className="program-course-row-code">{c.code}</span>
                        </div>
                      ))}
                      {linkedCourses.length > 3 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 10px' }}>+{linkedCourses.length - 3} more</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>No courses linked yet</div>
                )}
              </div>

              <div className="program-actions">
                <button className="btn btn-sm btn-primary" onClick={() => openManageCourses(p)}>
                  📚 Manage Courses
                </button>
                <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteProgram(p)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CoursePicker ──────────────────────────────────────────────────────────────

function CoursePicker({ allCourses, selectedIds, onSave }: { allCourses: Course[]; selectedIds: string[]; onSave: (ids: string[]) => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selectedIds))
  const [search, setSearch] = useState('')

  function toggle(id: string) {
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const filtered = allCourses.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px' }}>
        Select the courses that belong to this program. Nurses enrolled in the program will see all linked courses.
      </p>
      <input className="search-input" placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 360, overflowY: 'auto', marginBottom: 14 }}>
        {filtered.map(c => (
          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1.5px solid ${checked.has(c.id) ? 'var(--teal)' : 'var(--border)'}`, borderRadius: 8, background: checked.has(c.id) ? 'var(--teal-t)' : 'var(--panel)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
            <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggle(c.id)} style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.code} · {c.category} · {c.level}</div>
            </div>
            {c.mandatory && <span className="tag tag-red" style={{ fontSize: 10 }}>Mandatory</span>}
            <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-amber'}`}>{c.status}</span>
          </label>
        ))}
        {filtered.length === 0 && <div className="empty-state">No courses found.</div>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--teal)', marginBottom: 10 }}>{checked.size} course{checked.size !== 1 ? 's' : ''} selected</div>
      <div className="modal-form-actions">
        <button className="btn btn-primary" onClick={() => onSave(Array.from(checked))}>
          Save ({checked.size} courses)
        </button>
      </div>
    </div>
  )
}

// ── ProgramForm ───────────────────────────────────────────────────────────────

function ProgramForm({ initial, onSave }: { initial?: Partial<Program>; onSave: (d: Partial<Program>) => void }) {
  const [form, setForm] = useState({
    title: '', code: '', category: 'Clinical', objectives: '', outcomes: '', audience: 'All Nurses',
    mandatory: false, start_date: '', end_date: '', duration: '', pass_requirements: '',
    certificate_enabled: false, status: 'draft', ...initial,
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-row">
        <div className="form-group"><label>Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
        <div className="form-group"><label>Code</label><input value={form.code} onChange={e => set('code', e.target.value)} required /></div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {['Clinical', 'Safety', 'Compliance', 'Leadership', 'Technical'].map(c => <option key={c}>{c}</option>)}
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
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
          </select>
        </div>
        <div className="form-group checkbox-group" style={{ alignSelf: 'flex-end' }}>
          <label><input type="checkbox" checked={!!form.mandatory} onChange={e => set('mandatory', e.target.checked)} /> Mandatory</label>
          <label><input type="checkbox" checked={!!form.certificate_enabled} onChange={e => set('certificate_enabled', e.target.checked)} /> Certificate</label>
        </div>
      </div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  )
}
