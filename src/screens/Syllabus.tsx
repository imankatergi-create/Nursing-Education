import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Syllabus, CourseModule, Lesson, Material } from '../types'

interface LessonMaterialRow extends Material {
  _watch_pct: number
  _duration: string
}

interface MatConfig { watch_pct: number; duration_text: string }

export default function SyllabusScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [syllabi, setSyllabi] = useState<Syllabus[]>([])
  const [selected, setSelected] = useState<Syllabus | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({})
  const [lessonMaterials, setLessonMaterials] = useState<Record<string, LessonMaterialRow[]>>({})
  const [loading, setLoading] = useState(false)
  const loadCallRef = useRef(0)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('syllabi').select('*').order('title')
      const list = (data ?? []) as Syllabus[]
      setSyllabi(list)
      if (list[0]) loadSyllabus(list[0])
    })()
  }, [])

  async function reloadList() {
    const { data } = await supabase.from('syllabi').select('*').order('title')
    setSyllabi((data ?? []) as Syllabus[])
  }

  async function loadSyllabus(syl: Syllabus) {
    const callId = ++loadCallRef.current
    setSelected(syl)
    setLoading(true)

    const { data: mods } = await supabase
      .from('course_modules')
      .select('*')
      .eq('syllabus_id', syl.id)
      .order('order_index')
    if (callId !== loadCallRef.current) return

    const modList = (mods ?? []) as CourseModule[]
    const lessonMap: Record<string, Lesson[]> = {}
    const materialMap: Record<string, LessonMaterialRow[]> = {}

    for (const m of modList) {
      const { data: ls } = await supabase
        .from('lessons')
        .select('*')
        .eq('module_id', m.id)
        .order('order_index')
      if (callId !== loadCallRef.current) return
      lessonMap[m.id] = (ls ?? []) as Lesson[]
      for (const l of (ls ?? []) as Lesson[]) {
        const { data: lm } = await supabase
          .from('lesson_materials')
          .select('required_watch_pct, duration_text, material_id, materials(*)')
          .eq('lesson_id', l.id)
          .order('order_index')
        if (callId !== loadCallRef.current) return
        materialMap[l.id] = ((lm ?? []) as any[])
          .map(r => ({ ...r.materials, _watch_pct: r.required_watch_pct ?? 100, _duration: r.duration_text ?? '' }))
          .filter((r: any) => r?.id)
      }
    }

    if (callId !== loadCallRef.current) return
    setModules(modList)
    setLessons(lessonMap)
    setLessonMaterials(materialMap)
    setLoading(false)
  }

  async function saveLessonMaterials(lessonId: string, configs: Record<string, MatConfig>) {
    await supabase.from('lesson_materials').delete().eq('lesson_id', lessonId)
    const entries = Object.entries(configs)
    if (entries.length > 0) {
      await supabase.from('lesson_materials').insert(
        entries.map(([mid, cfg], i) => ({
          lesson_id: lessonId,
          material_id: mid,
          order_index: i,
          required_watch_pct: cfg.watch_pct,
          duration_text: cfg.duration_text,
        }))
      )
    }
  }

  async function deleteModule(mod: CourseModule) {
    if (!confirm(`Delete module "${mod.title}" and all its lessons?`)) return
    await supabase.from('course_modules').delete().eq('id', mod.id)
    if (selected) loadSyllabus(selected)
    toast('Module deleted')
  }

  async function deleteLesson(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return
    await supabase.from('lessons').delete().eq('id', lesson.id)
    if (selected) loadSyllabus(selected)
    toast('Lesson deleted')
  }

  function openCreateSyllabus() {
    openModal({
      title: 'Create Syllabus',
      body: (
        <SyllabusForm
          onSave={async d => {
            const { data, error } = await supabase
              .from('syllabi')
              .insert(d)
              .select('*')
              .maybeSingle()
            if (error) { toast('Error: ' + error.message); return }
            await reloadList()
            if (data) loadSyllabus(data as Syllabus)
            closeModal()
            toast('Syllabus created')
          }}
        />
      ),
    })
  }

  function openEditSyllabus(syl: Syllabus) {
    openModal({
      title: 'Edit Syllabus',
      body: (
        <SyllabusForm
          initial={syl}
          onSave={async d => {
            await supabase.from('syllabi').update(d).eq('id', syl.id)
            await reloadList()
            setSelected(s => s?.id === syl.id ? { ...s, ...d } : s)
            closeModal()
            toast('Syllabus updated')
          }}
        />
      ),
    })
  }

  async function deleteSyllabus(syl: Syllabus) {
    if (!confirm(`Delete syllabus "${syl.title}" and all its modules/lessons?`)) return
    await supabase.from('syllabi').delete().eq('id', syl.id)
    const remaining = syllabi.filter(s => s.id !== syl.id)
    setSyllabi(remaining)
    if (selected?.id === syl.id) {
      if (remaining[0]) loadSyllabus(remaining[0])
      else { setSelected(null); setModules([]) }
    }
    toast('Syllabus deleted')
  }

  function openAddModule() {
    if (!selected) return
    openModal({
      title: 'Add Module',
      body: (
        <ModuleForm
          onSave={async d => {
            const { error } = await supabase
              .from('course_modules')
              .insert({ ...d, syllabus_id: selected.id, order_index: modules.length + 1 })
            if (error) { toast('Error: ' + error.message); return }
            loadSyllabus(selected)
            closeModal()
            toast('Module added')
          }}
        />
      ),
    })
  }

  function openEditModule(mod: CourseModule) {
    openModal({
      title: 'Edit Module',
      body: (
        <ModuleForm
          initial={mod}
          onSave={async d => {
            await supabase.from('course_modules').update(d).eq('id', mod.id)
            if (selected) loadSyllabus(selected)
            closeModal()
            toast('Module updated')
          }}
        />
      ),
    })
  }

  function openAddLesson(moduleId: string) {
    openModal({
      title: 'Add Lesson', wide: true,
      body: (
        <LessonForm
          onSave={async (d, matConfigs) => {
            const count = (lessons[moduleId] ?? []).length
            const payload: Record<string, unknown> = { ...d, module_id: moduleId, order_index: count + 1 }
            if (!payload.quiz_id) delete payload.quiz_id
            const { data: created, error } = await supabase
              .from('lessons')
              .insert(payload)
              .select('id')
              .maybeSingle()
            if (error) { toast('Error saving lesson: ' + error.message); return }
            if (created?.id) await saveLessonMaterials(created.id, matConfigs)
            if (selected) loadSyllabus(selected)
            closeModal()
            toast('Lesson added')
          }}
        />
      ),
    })
  }

  function openEditLesson(lesson: Lesson) {
    openModal({
      title: 'Edit Lesson', wide: true,
      body: (
        <LessonForm
          initial={lesson}
          onSave={async (d, matConfigs) => {
            const payload: Record<string, unknown> = { ...d }
            if (!payload.quiz_id) payload.quiz_id = null
            const { error } = await supabase.from('lessons').update(payload).eq('id', lesson.id)
            if (error) { toast('Error updating lesson: ' + error.message); return }
            await saveLessonMaterials(lesson.id, matConfigs)
            if (selected) loadSyllabus(selected)
            closeModal()
            toast('Lesson updated')
          }}
        />
      ),
    })
  }

  const typeIcon: Record<string, string> = { video: '🎬', doc: '📄', quiz: '❓', eval: '📝' }
  const typeColor: Record<string, string> = { video: 'blue', doc: 'teal', quiz: 'amber', eval: 'purple' }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Syllabus Builder</h1>
          <p className="screen-subtitle">Build reusable curriculum syllabuses with modules and lessons</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected && (
            <button className="btn btn-outline" onClick={() => openAddModule()}>+ Add Module</button>
          )}
          <button className="btn btn-primary" onClick={openCreateSyllabus}>+ Create Syllabus</button>
        </div>
      </div>

      <div className="syllabus-layout">
        {/* ── Left: syllabus list ── */}
        <div className="syllabus-sidebar">
          <h4>Syllabuses</h4>
          {syllabi.length === 0 ? (
            <div style={{ padding: '8px', color: 'var(--muted)', fontSize: 13 }}>
              No syllabuses yet. Click "+ Create Syllabus".
            </div>
          ) : syllabi.map(s => (
            <div
              key={s.id}
              className={`syllabus-course-item${selected?.id === s.id ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer', width: '100%' }}
              onClick={() => loadSyllabus(s)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="syllabus-course-title">{s.title}</div>
                {s.description && (
                  <div className="syllabus-course-code" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>
                    {s.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => openEditSyllabus(s)}
                >✎</button>
                <button
                  className="btn btn-sm btn-danger"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => deleteSyllabus(s)}
                >✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: modules + lessons ── */}
        <div className="syllabus-content">
          {!selected ? (
            <div className="empty-state">Select or create a syllabus to get started.</div>
          ) : loading ? (
            <div className="loading-state">Loading…</div>
          ) : modules.length === 0 ? (
            <div className="empty-state">No modules yet. Click "+ Add Module" to get started.</div>
          ) : modules.map(mod => (
            <div key={mod.id} className="module-block">
              <div className="module-header">
                <h3>{mod.title}</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => openEditModule(mod)}>Edit</button>
                  <button className="btn btn-sm" onClick={() => openAddLesson(mod.id)}>+ Lesson</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteModule(mod)}>Delete</button>
                </div>
              </div>
              <div className="lessons-list">
                {(lessons[mod.id] ?? []).length === 0 ? (
                  <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>
                    No lessons yet — add one above.
                  </div>
                ) : (lessons[mod.id] ?? []).map(lesson => (
                  <div key={lesson.id} className="lesson-row">
                    <span className="lesson-type-icon">{typeIcon[lesson.type] ?? '📌'}</span>
                    <div className="lesson-info">
                      <span className="lesson-title">{lesson.title}</span>
                      <span className="lesson-meta">{lesson.duration_text} · {lesson.requirement}</span>
                      {(lessonMaterials[lesson.id] ?? []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {(lessonMaterials[lesson.id] ?? []).map(m => (
                            <span key={m.id} className="badge badge-gray" style={{ fontSize: 11 }}>
                              📎 {m.title}
                              {m._watch_pct !== 100 ? ` · ${m._watch_pct}%` : ''}
                              {m._duration ? ` · ${m._duration}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                      <span className={`badge badge-${typeColor[lesson.type] ?? 'gray'}`}>{lesson.type}</span>
                      <button className="btn btn-sm btn-outline" onClick={() => openEditLesson(lesson)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteLesson(lesson)}>Del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-forms ─────────────────────────────────────────────────────── */

function SyllabusForm({
  initial,
  onSave,
}: {
  initial?: Syllabus
  onSave: (d: { title: string; description: string }) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title, description }) }}>
      <div className="form-group">
        <label>Syllabus Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required autoFocus placeholder="e.g. ICU Nursing Fundamentals" />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief overview of what this syllabus covers…"
        />
      </div>
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Create Syllabus'}</button>
      </div>
    </form>
  )
}

function ModuleForm({ initial, onSave }: { initial?: CourseModule; onSave: (d: { title: string }) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title }) }}>
      <div className="form-group">
        <label>Module Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
      </div>
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary">{initial ? 'Save' : 'Add'}</button>
      </div>
    </form>
  )
}

function LessonForm({
  initial,
  onSave,
}: {
  initial?: Lesson
  onSave: (d: Partial<Lesson>, materials: Record<string, MatConfig>) => void
}) {
  const [quizzes, setQuizzes] = useState<{ id: string; title: string }[]>([])
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const [matConfigs, setMatConfigs] = useState<Record<string, MatConfig>>({})
  const [loadingMats, setLoadingMats] = useState(true)
  const [form, setForm] = useState<{
    title: string
    type: 'video' | 'doc' | 'quiz' | 'eval'
    duration_text: string
    requirement: string
    quiz_id: string
  }>({
    title: initial?.title ?? '',
    type: (initial?.type ?? 'video') as 'video' | 'doc' | 'quiz' | 'eval',
    duration_text: initial?.duration_text ?? '',
    requirement: initial?.requirement ?? '',
    quiz_id: (initial as any)?.quiz_id ?? '',
  })

  useEffect(() => {
    ;(async () => {
      const [{ data: q }, { data: m }, existingRes] = await Promise.all([
        supabase.from('quizzes').select('id, title').order('title'),
        supabase.from('materials').select('*').order('title'),
        initial?.id
          ? supabase
              .from('lesson_materials')
              .select('material_id, required_watch_pct, duration_text')
              .eq('lesson_id', initial.id)
          : Promise.resolve({ data: [] }),
      ])
      setQuizzes(q ?? [])
      setAllMaterials(m ?? [])
      const map: Record<string, MatConfig> = {}
      for (const e of (existingRes.data ?? [])) {
        map[e.material_id] = { watch_pct: e.required_watch_pct ?? 100, duration_text: e.duration_text ?? '' }
      }
      setMatConfigs(map)
      setLoadingMats(false)
    })()
  }, [])

  function toggleMat(id: string) {
    setMatConfigs(c => {
      const n = { ...c }
      if (n[id]) { delete n[id] } else { n[id] = { watch_pct: 100, duration_text: '' } }
      return n
    })
  }

  function updateMatConfig(id: string, field: keyof MatConfig, value: string | number) {
    setMatConfigs(c => ({ ...c, [id]: { ...c[id], [field]: value } }))
  }

  const selectedIds = new Set(Object.keys(matConfigs))

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form, matConfigs) }}>
      <div className="form-group">
        <label>Title</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required autoFocus />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'video' | 'doc' | 'quiz' | 'eval' }))}>
            <option value="video">Video</option>
            <option value="doc">Document</option>
            <option value="quiz">Quiz</option>
            <option value="eval">Evaluation</option>
          </select>
        </div>
        <div className="form-group">
          <label>Duration</label>
          <input value={form.duration_text} onChange={e => setForm(f => ({ ...f, duration_text: e.target.value }))} placeholder="e.g. 15 min" />
        </div>
      </div>
      {form.type === 'quiz' && (
        <div className="form-group">
          <label>Link Quiz</label>
          <select value={form.quiz_id} onChange={e => setForm(f => ({ ...f, quiz_id: e.target.value }))}>
            <option value="">— Select a quiz —</option>
            {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
        </div>
      )}
      <div className="form-group">
        <label>Requirement</label>
        <input value={form.requirement} onChange={e => setForm(f => ({ ...f, requirement: e.target.value }))} placeholder="e.g. Watch 90%, Score ≥80%" />
      </div>

      <div className="form-section-title" style={{ marginTop: 16 }}>
        Attach Materials
        <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 12, marginLeft: 6, color: 'var(--faint)', letterSpacing: 0 }}>— optional</span>
      </div>

      {loadingMats ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Loading materials…</div>
      ) : allMaterials.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
          No materials in library yet. Upload from the Materials screen first.
        </div>
      ) : (
        <div className="mat-picker">
          {allMaterials.map(m => {
            const sel = selectedIds.has(m.id)
            const cfg = matConfigs[m.id] ?? { watch_pct: 100, duration_text: '' }
            const typeEmoji: Record<string, string> = { video: '🎬', doc: '📄', link: '🔗', scorm: '📦', audio: '🎧', image: '🖼️' }
            return (
              <div
                key={m.id}
                className={`mat-card${sel ? ' selected' : ''}`}
                onClick={() => toggleMat(m.id)}
              >
                <div className="mat-card-row">
                  <svg className="mat-checkbox" width="18" height="18" viewBox="0 0 18 18">
                    <rect x="1" y="1" width="16" height="16" rx="3"
                      fill={sel ? '#0891b2' : '#fff'}
                      stroke={sel ? '#0891b2' : '#cbd5e1'}
                      strokeWidth="2"
                    />
                    {sel && <path d="M4.5 9l3 3 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
                  </svg>
                  <div className="mat-info">
                    <div className="mat-title">{typeEmoji[m.type] ?? '📎'} {m.title}</div>
                    <div className="mat-sub">{m.type}{m.size_text ? ` · ${m.size_text}` : ''}</div>
                  </div>
                  {sel && <span className="mat-badge-sel">✓ On</span>}
                </div>
                {sel && (
                  <div className="mat-config" onClick={e => e.stopPropagation()}>
                    <div>
                      <span className="mat-config-label">Required Watch %</span>
                      <input
                        type="number" min={0} max={100}
                        value={cfg.watch_pct}
                        onChange={e => updateMatConfig(m.id, 'watch_pct', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      />
                    </div>
                    <div>
                      <span className="mat-config-label">Duration</span>
                      <input
                        type="text"
                        value={cfg.duration_text}
                        placeholder="e.g. 10 min"
                        onChange={e => updateMatConfig(m.id, 'duration_text', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="modal-form-actions" style={{ marginTop: 16 }}>
        {selectedIds.size > 0 && (
          <span style={{ color: 'var(--muted)', fontSize: 13, marginRight: 'auto' }}>
            {selectedIds.size} material{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
        )}
        <button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Add Lesson'}</button>
      </div>
    </form>
  )
}
