import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Course, CourseModule, Lesson, Material } from '../types'

interface LessonMaterialRow extends Material {
  _watch_pct: number
  _duration: string
}

export default function SyllabusScreen() {
  const { params, toast, openModal, closeModal } = useApp()
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({})
  const [lessonMaterials, setLessonMaterials] = useState<Record<string, LessonMaterialRow[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('courses').select('*').order('title')
      const list = data ?? []
      setCourses(list)
      const target = list.find(c => c.id === params.courseId) ?? list[0]
      if (target) loadCourse(target)
    })()
  }, [params.courseId])

  async function loadCourse(course: Course) {
    setSelectedCourse(course)
    setLoading(true)
    const { data: mods } = await supabase.from('course_modules').select('*').eq('course_id', course.id).order('order_index')
    const modList = mods ?? []
    setModules(modList)
    const lessonMap: Record<string, Lesson[]> = {}
    const materialMap: Record<string, LessonMaterialRow[]> = {}
    for (const m of modList) {
      const { data: ls } = await supabase.from('lessons').select('*').eq('module_id', m.id).order('order_index')
      lessonMap[m.id] = ls ?? []
      for (const l of (ls ?? [])) {
        const { data: lm } = await supabase
          .from('lesson_materials')
          .select('required_watch_pct, duration_text, material_id, materials(*)')
          .eq('lesson_id', l.id)
          .order('order_index')
        materialMap[l.id] = ((lm ?? []) as any[]).map(r => ({
          ...r.materials,
          _watch_pct: r.required_watch_pct ?? 100,
          _duration: r.duration_text ?? '',
        })).filter((r: any) => r?.id)
      }
    }
    setLessons(lessonMap)
    setLessonMaterials(materialMap)
    setLoading(false)
  }

  async function deleteModule(mod: CourseModule) {
    if (!confirm(`Delete module "${mod.title}" and all its lessons?`)) return
    await supabase.from('course_modules').delete().eq('id', mod.id)
    if (selectedCourse) loadCourse(selectedCourse)
    toast('Module deleted')
  }

  async function deleteLesson(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return
    await supabase.from('lessons').delete().eq('id', lesson.id)
    if (selectedCourse) loadCourse(selectedCourse)
    toast('Lesson deleted')
  }

  function openAddModule() {
    if (!selectedCourse) return
    openModal({
      title: 'Add Module',
      body: <ModuleForm onSave={async d => {
        await supabase.from('course_modules').insert({ ...d, course_id: selectedCourse.id, order_index: modules.length + 1 })
        loadCourse(selectedCourse); closeModal(); toast('Module added')
      }} />,
    })
  }

  function openEditModule(mod: CourseModule) {
    openModal({
      title: 'Edit Module',
      body: <ModuleForm initial={mod} onSave={async d => {
        await supabase.from('course_modules').update(d).eq('id', mod.id)
        if (selectedCourse) loadCourse(selectedCourse); closeModal(); toast('Module updated')
      }} />,
    })
  }

  function openAddLesson(moduleId: string) {
    openModal({
      title: 'Add Lesson',
      body: <LessonForm onSave={async d => {
        const count = (lessons[moduleId] ?? []).length
        await supabase.from('lessons').insert({ ...d, module_id: moduleId, order_index: count + 1 })
        if (selectedCourse) loadCourse(selectedCourse); closeModal(); toast('Lesson added')
      }} />,
    })
  }

  function openEditLesson(lesson: Lesson) {
    openModal({
      title: 'Edit Lesson',
      body: <LessonForm initial={lesson} onSave={async d => {
        await supabase.from('lessons').update(d).eq('id', lesson.id)
        if (selectedCourse) loadCourse(selectedCourse); closeModal(); toast('Lesson updated')
      }} />,
    })
  }

  function openAttachMaterials(lesson: Lesson) {
    openModal({
      title: `Materials — ${lesson.title}`, wide: true,
      body: <MaterialPicker
        lessonId={lesson.id}
        onDone={() => { if (selectedCourse) loadCourse(selectedCourse); closeModal() }}
      />,
    })
  }

  const typeIcon: Record<string, string> = { video: '🎬', doc: '📄', quiz: '❓', eval: '📝' }
  const typeColor: Record<string, string> = { video: 'blue', doc: 'teal', quiz: 'amber', eval: 'purple' }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Syllabus Builder</h1>
          <p className="screen-subtitle">Manage course modules, lessons and materials</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModule} disabled={!selectedCourse}>+ Add Module</button>
      </div>

      <div className="syllabus-layout">
        <div className="syllabus-sidebar">
          <h4>Courses</h4>
          {courses.length === 0 ? (
            <div style={{ padding: '8px', color: 'var(--muted)', fontSize: 13 }}>No courses yet.</div>
          ) : courses.map(c => (
            <button key={c.id} className={`syllabus-course-item${selectedCourse?.id === c.id ? ' active' : ''}`} onClick={() => loadCourse(c)}>
              <div className="syllabus-course-title">{c.title}</div>
              <div className="syllabus-course-code">{c.code}</div>
            </button>
          ))}
        </div>

        <div className="syllabus-content">
          {loading ? <div className="loading-state">Loading…</div> : modules.length === 0 ? (
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
                  <div style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>No lessons yet — add one above.</div>
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
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => openAttachMaterials(lesson)}
                        title="Attach materials"
                      >
                        📎{(lessonMaterials[lesson.id] ?? []).length > 0 ? ` ${(lessonMaterials[lesson.id] ?? []).length}` : ''}
                      </button>
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

function ModuleForm({ initial, onSave }: { initial?: CourseModule; onSave: (d: { title: string }) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title }) }}>
      <div className="form-group"><label>Module Title</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save' : 'Add'}</button></div>
    </form>
  )
}

function LessonForm({ initial, onSave }: { initial?: Lesson; onSave: (d: Partial<Lesson>) => void }) {
  const [quizzes, setQuizzes] = useState<{ id: string; title: string }[]>([])
  const [form, setForm] = useState<{ title: string; type: 'video'|'doc'|'quiz'|'eval'; duration_text: string; requirement: string; quiz_id: string }>({
    title: initial?.title ?? '',
    type: (initial?.type ?? 'video') as 'video'|'doc'|'quiz'|'eval',
    duration_text: initial?.duration_text ?? '',
    requirement: initial?.requirement ?? '',
    quiz_id: (initial as any)?.quiz_id ?? '',
  })

  useEffect(() => {
    supabase.from('quizzes').select('id, title').order('title').then(({ data }) => setQuizzes(data ?? []))
  }, [])

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required /></div>
      <div className="form-row">
        <div className="form-group"><label>Type</label>
          <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value as 'video'|'doc'|'quiz'|'eval'}))}>
            <option value="video">Video</option><option value="doc">Document</option><option value="quiz">Quiz</option><option value="eval">Evaluation</option>
          </select>
        </div>
        <div className="form-group"><label>Duration</label><input value={form.duration_text} onChange={e => setForm(f => ({...f, duration_text: e.target.value}))} placeholder="e.g. 15 min" /></div>
      </div>
      {form.type === 'quiz' && (
        <div className="form-group"><label>Link Quiz</label>
          <select value={form.quiz_id} onChange={e => setForm(f => ({...f, quiz_id: e.target.value}))}>
            <option value="">— Select a quiz —</option>
            {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
        </div>
      )}
      <div className="form-group"><label>Requirement</label><input value={form.requirement} onChange={e => setForm(f => ({...f, requirement: e.target.value}))} placeholder="e.g. Watch 90%, Score ≥80%" /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Add Lesson'}</button></div>
    </form>
  )
}

interface MatConfig { watch_pct: number; duration_text: string }

function MaterialPicker({ lessonId, onDone }: { lessonId: string; onDone: () => void }) {
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const [configs, setConfigs] = useState<Record<string, MatConfig>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: mats }, { data: existing }] = await Promise.all([
        supabase.from('materials').select('*').order('title'),
        supabase.from('lesson_materials')
          .select('material_id, required_watch_pct, duration_text')
          .eq('lesson_id', lessonId),
      ])
      setAllMaterials(mats ?? [])
      const map: Record<string, MatConfig> = {}
      for (const e of (existing ?? [])) {
        map[e.material_id] = { watch_pct: e.required_watch_pct ?? 100, duration_text: e.duration_text ?? '' }
      }
      setConfigs(map)
      setLoading(false)
    })()
  }, [lessonId])

  function toggle(id: string) {
    setConfigs(c => {
      const n = { ...c }
      if (n[id]) { delete n[id] } else { n[id] = { watch_pct: 100, duration_text: '' } }
      return n
    })
  }

  function updateConfig(id: string, field: keyof MatConfig, value: string | number) {
    setConfigs(c => ({ ...c, [id]: { ...c[id], [field]: value } }))
  }

  async function save() {
    setSaving(true)
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
    setSaving(false)
    onDone()
  }

  const typeIcon: Record<string, string> = { PDF: '📄', Video: '🎬', PPT: '📊', Checklist: '✅', Protocol: '📋', 'Link/URL': '🔗', Image: '🖼️', Audio: '🎵' }
  const selectedIds = new Set(Object.keys(configs))

  if (loading) return <div className="loading-state">Loading materials…</div>

  return (
    <div>
      <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>
        Select materials and configure the required watch percentage and duration for each.
      </p>
      {allMaterials.length === 0 ? (
        <div className="empty-state">No materials in library yet. Upload materials first.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', marginBottom: 16 }}>
          {allMaterials.map(m => {
            const sel = selectedIds.has(m.id)
            const cfg = configs[m.id] ?? { watch_pct: 100, duration_text: '' }
            return (
              <div key={m.id} style={{
                border: `1.5px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 8, overflow: 'hidden',
                background: sel ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : '',
                transition: 'border-color 0.15s',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sel} onChange={() => toggle(m.id)} />
                  <span style={{ fontSize: 18 }}>{typeIcon[m.type] ?? '📎'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.type}{m.size_text ? ` · ${m.size_text}` : ''}</div>
                  </div>
                  {sel && <span className="badge badge-blue">Selected</span>}
                </label>
                {sel && (
                  <div style={{ display: 'flex', gap: 12, padding: '0 12px 12px', background: 'var(--bg)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 4 }}>Required Watch %</label>
                      <input
                        type="number" min={0} max={100}
                        value={cfg.watch_pct}
                        onChange={e => updateConfig(m.id, 'watch_pct', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 4 }}>Duration</label>
                      <input
                        type="text"
                        value={cfg.duration_text}
                        placeholder="e.g. 10 min"
                        onChange={e => updateConfig(m.id, 'duration_text', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="modal-form-actions">
        <span style={{ color: 'var(--muted)', fontSize: 13, marginRight: 'auto' }}>
          {selectedIds.size} material{selectedIds.size !== 1 ? 's' : ''} selected
        </span>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Materials'}
        </button>
      </div>
    </div>
  )
}
