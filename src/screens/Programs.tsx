import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Course, Program } from '../types'

interface ProgramWithCourses extends Program {
  courses: Course[]
}

const STATUS_COLOR: Record<string, string> = { active: 'badge-green', draft: 'badge-amber', archived: 'badge-gray' }
const CATEGORIES = ['Clinical', 'Safety', 'Compliance', 'Leadership', 'Technical']

export default function ProgramsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [programs, setPrograms] = useState<ProgramWithCourses[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'active' | 'draft' | 'archived'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: progs }, { data: courses }, { data: pc }] = await Promise.all([
      supabase.from('programs').select('*').order('title'),
      supabase.from('courses').select('*').order('title'),
      supabase.from('programs_courses').select('program_id, course_id'),
    ])

    const courseMap = Object.fromEntries((courses ?? []).map(c => [c.id, c]))
    const pcMap: Record<string, Course[]> = {}
    for (const row of (pc ?? [])) {
      if (!pcMap[row.program_id]) pcMap[row.program_id] = []
      if (courseMap[row.course_id]) pcMap[row.program_id].push(courseMap[row.course_id])
    }

    setPrograms((progs ?? []).map(p => ({ ...p, courses: pcMap[p.id] ?? [] })))
    setAllCourses(courses ?? [])
    setLoading(false)
  }

  const tabs = ['all', 'active', 'draft', 'archived'] as const
  const filtered = programs.filter(p => {
    const matchTab = tab === 'all' || p.status === tab
    const q = search.toLowerCase()
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    return matchTab && matchQ
  })

  function openCreate() {
    openModal({
      title: 'Create Program', wide: true,
      body: (
        <ProgramForm
          allCourses={allCourses}
          onSave={async (data, courseIds) => {
            const { data: inserted, error } = await supabase
              .from('programs')
              .insert(data)
              .select('id')
              .single()
            if (error || !inserted) { toast('Error creating program'); return }
            if (courseIds.length > 0) {
              await supabase.from('programs_courses').insert(
                courseIds.map((cid, i) => ({ program_id: inserted.id, course_id: cid, order_index: i }))
              )
            }
            fetchAll(); closeModal(); toast('Program created')
          }}
        />
      ),
    })
  }

  function openEdit(p: ProgramWithCourses) {
    openModal({
      title: 'Edit Program', wide: true,
      body: (
        <ProgramForm
          initial={p}
          initialCourseIds={p.courses.map(c => c.id)}
          allCourses={allCourses}
          onSave={async (data, courseIds) => {
            await supabase.from('programs').update(data).eq('id', p.id)
            await supabase.from('programs_courses').delete().eq('program_id', p.id)
            if (courseIds.length > 0) {
              await supabase.from('programs_courses').insert(
                courseIds.map((cid, i) => ({ program_id: p.id, course_id: cid, order_index: i }))
              )
            }
            fetchAll(); closeModal(); toast('Program updated')
          }}
        />
      ),
    })
  }

  async function deleteProgram(p: ProgramWithCourses) {
    if (!confirm(`Delete program "${p.title}"? This cannot be undone.`)) return
    await supabase.from('programs_courses').delete().eq('program_id', p.id)
    await supabase.from('programs').delete().eq('id', p.id)
    fetchAll()
    toast('Program deleted')
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Programs</h1>
          <p className="screen-subtitle">{programs.length} training program{programs.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Program</button>
      </div>

      <div className="table-toolbar">
        <input
          className="search-input"
          placeholder="Search programs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="tab-row">
        {tabs.map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="tab-count">
              {t === 'all' ? programs.length : programs.filter(p => p.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {search ? 'No programs match your search.' : 'No programs yet. Click "+ Create Program" to get started.'}
        </div>
      ) : (
        <div className="programs-grid">
          {filtered.map(p => (
            <ProgramCard
              key={p.id}
              program={p}
              onEdit={() => openEdit(p)}
              onDelete={() => deleteProgram(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProgramCard({ program: p, onEdit, onDelete }: {
  program: ProgramWithCourses
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visibleCourses = expanded ? p.courses : p.courses.slice(0, 3)

  return (
    <div className="program-card">
      <div className="program-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="program-code">{p.code}</div>
          <h3 className="program-title">{p.title}</h3>
        </div>
        <span className={`badge ${STATUS_COLOR[p.status] ?? 'badge-gray'}`}>{p.status}</span>
      </div>

      <div className="program-meta">
        {p.start_date && <span>📅 {p.start_date}{p.end_date ? ` – ${p.end_date}` : ''}</span>}
        {p.duration && <span>⏱ {p.duration}</span>}
        {p.audience && <span>🎯 {p.audience}</span>}
      </div>

      {p.objectives && (
        <p className="program-objectives" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.objectives}
        </p>
      )}

      <div className="program-tags">
        {p.category && <span className="tag">{p.category}</span>}
        {p.mandatory && <span className="tag tag-red">Mandatory</span>}
        {p.certificate_enabled && <span className="tag tag-blue">Certificate</span>}
      </div>

      {/* Linked courses */}
      {p.courses.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Courses ({p.courses.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {visibleCourses.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)', fontSize: 15 }}>{c.thumbnail_icon || '📚'}</span>
                <span style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title}
                </span>
                <span className="badge badge-gray" style={{ fontSize: 11, flexShrink: 0 }}>{c.code}</span>
              </div>
            ))}
            {p.courses.length > 3 && (
              <button
                style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, marginTop: 2 }}
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? 'Show less' : `+${p.courses.length - 3} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {p.courses.length === 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 13, color: 'var(--muted)' }}>
          No courses linked
        </div>
      )}

      <div className="program-actions">
        <button className="btn btn-sm btn-primary" onClick={onEdit}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function ProgramForm({ initial, initialCourseIds = [], allCourses, onSave }: {
  initial?: Partial<Program>
  initialCourseIds?: string[]
  allCourses: Course[]
  onSave: (data: Partial<Program>, courseIds: string[]) => void
}) {
  const [formTab, setFormTab] = useState<'details' | 'courses'>('details')
  const [form, setForm] = useState({
    title: '', code: '', category: 'Clinical', description: '', objectives: '',
    outcomes: '', audience: 'All Staff', mandatory: false,
    start_date: '', end_date: '', duration: '', pass_requirements: '',
    certificate_enabled: false, status: 'draft' as string,
    ...initial,
  })
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set(initialCourseIds))
  const [courseSearch, setCourseSearch] = useState('')

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  function toggleCourse(id: string) {
    setSelectedCourseIds(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const filteredCourses = allCourses.filter(c =>
    !courseSearch ||
    c.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(courseSearch.toLowerCase())
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { ...data } = form as any
    onSave(data, Array.from(selectedCourseIds))
  }

  const courseStatusColor: Record<string, string> = { active: 'badge-green', draft: 'badge-amber', archived: 'badge-gray' }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      {/* Form tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {(['details', 'courses'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setFormTab(t)}
            style={{
              padding: '8px 20px',
              background: 'none',
              border: 'none',
              borderBottom: formTab === t ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              color: formTab === t ? 'var(--primary)' : 'var(--muted)',
              fontWeight: formTab === t ? 600 : 400,
              cursor: 'pointer',
              fontSize: 14,
              textTransform: 'capitalize',
            }}
          >
            {t === 'details' ? 'Program Details' : (
              <span>
                Courses
                {selectedCourseIds.size > 0 && (
                  <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 11 }}>{selectedCourseIds.size}</span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {formTab === 'details' && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>
            <div className="form-group" style={{ maxWidth: 140 }}>
              <label>Code *</label>
              <input value={form.code} onChange={e => set('code', e.target.value)} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Target Audience</label>
              <input value={form.audience} onChange={e => set('audience', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Objectives</label>
            <textarea rows={2} value={form.objectives} onChange={e => set('objectives', e.target.value)} placeholder="What participants will achieve…" />
          </div>

          <div className="form-group">
            <label>Outcomes</label>
            <textarea rows={2} value={form.outcomes} onChange={e => set('outcomes', e.target.value)} placeholder="Expected results after completion…" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Duration</label>
              <input value={form.duration} onChange={e => set('duration', e.target.value)} placeholder="e.g. 3 weeks" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Pass Requirements</label>
              <input value={form.pass_requirements} onChange={e => set('pass_requirements', e.target.value)} placeholder="e.g. 80% on all quizzes" />
            </div>
          </div>

          <div className="form-row" style={{ gap: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={!!form.mandatory} onChange={e => set('mandatory', e.target.checked)} />
              Mandatory
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={!!form.certificate_enabled} onChange={e => set('certificate_enabled', e.target.checked)} />
              Certificate Enabled
            </label>
          </div>
        </>
      )}

      {formTab === 'courses' && (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
            Select the courses that belong to this program. They will appear in the program view for enrolled users.
          </p>
          <input
            className="search-input"
            style={{ marginBottom: 10 }}
            placeholder="Filter courses…"
            value={courseSearch}
            onChange={e => setCourseSearch(e.target.value)}
          />
          {allCourses.length === 0 ? (
            <div className="empty-state">No courses created yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto' }}>
              {filteredCourses.map(c => {
                const sel = selectedCourseIds.has(c.id)
                return (
                  <label key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    border: `1.5px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: sel ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : '',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}>
                    <input type="checkbox" checked={sel} onChange={() => toggleCourse(c.id)} />
                    <span style={{ fontSize: 20 }}>{c.thumbnail_icon || '📚'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.code} · {c.category} · {c.duration}</div>
                    </div>
                    <span className={`badge ${courseStatusColor[c.status] ?? 'badge-gray'}`} style={{ flexShrink: 0 }}>{c.status}</span>
                  </label>
                )
              })}
              {filteredCourses.length === 0 && <div className="empty-state">No courses match your search.</div>}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
            {selectedCourseIds.size} course{selectedCourseIds.size !== 1 ? 's' : ''} selected
          </div>
        </>
      )}

      <div className="modal-form-actions" style={{ marginTop: 20 }}>
        {formTab === 'details' ? (
          <button type="button" className="btn btn-outline" onClick={() => setFormTab('courses')}>
            Next: Select Courses →
          </button>
        ) : (
          <button type="button" className="btn btn-outline" onClick={() => setFormTab('details')}>
            ← Back to Details
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {initial?.id ? 'Save Changes' : 'Create Program'}
        </button>
      </div>
    </form>
  )
}
