import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Course, CourseModule, Lesson, Material } from '../types'

interface LessonMaterialRow extends Material {
  _watch_pct: number
  _duration: string
}

interface MatConfig { watch_pct: number; duration_text: string }

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
      title: 'Add Lesson', wide: true,
      body: <LessonForm onSave={async (d, matConfigs) => {
        const count = (lessons[moduleId] ?? []).length
        const { data: created } = await supabase
          .from('lessons')
          .insert({ ...d, module_id: moduleId, order_index: count + 1 })
          .select('id')
          .maybeSingle()
        if (created?.id) await saveLessonMaterials(created.id, matConfigs)
        if (selectedCourse) loadCourse(selectedCourse); closeModal(); toast('Lesson added')
      }} />,
    })
  }

  function openEditLesson(lesson: Lesson) {
    openModal({
      title: 'Edit Lesson', wide: true,
      body: <LessonForm initial={lesson} onSave={async (d, matConfigs) => {
        await supabase.from('lessons').update(d).eq('id', lesson.id)
        await saveLessonMaterials(lesson.id, matConfigs)
        if (selectedCourse) loadCourse(selectedCourse); closeModal(); toast('Lesson updated')
      }} />,
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
      <div className="form-group"><label>Module Title</label><input value={title} onChange={e => setTitle(e.target.value)} required autoFocus /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save' : 'Add'}</button></div>
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
          ? supabase.from('lesson_materials').select('material_id, required_watch_pct, duration_text').eq('lesson_id', initial.id)
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

      {/* ── Materials ─────────────────────────────────────── */}
      <div className="form-section-title" style={{ marginTop: 16 }}>
        Attach Materials
        <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12, marginLeft: 6 }}>— optional</span>
      </div>

      {loadingMats ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Loading materials…</div>
      ) : allMaterials.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
          No materials in library yet. Upload materials first from the Materials screen.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 300, overflowY: 'auto', paddingRight: 2 }}>
          {allMaterials.map(m => {
            const sel = selectedIds.has(m.id)
            const cfg = matConfigs[m.id] ?? { watch_pct: 100, duration_text: '' }
            return (
              <div
                key={m.id}
                style={{
                  border: `2px solid ${sel ? '#0891b2' : '#e2e8f0'}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: sel ? '#f0f9ff' : '#ffffff',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => toggleMat(m.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px' }}>
                  {/* Custom checkbox — bypasses all native input CSS issues */}
                  <div style={{
                    width: 18, height: 18, minWidth: 18, minHeight: 18,
                    border: `2px solid ${sel ? '#0891b2' : '#94a3b8'}`,
                    borderRadius: 4,
                    background: sel ? '#0891b2' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 12, color: '#fff', fontWeight: 700, lineHeight: 1,
                  }}>
                    {sel ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', lineHeight: 1.3 }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {m.type}{m.size_text ? ` · ${m.size_text}` : ''}
                    </div>
                  </div>
                  {sel && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px',
                      background: '#0891b2', color: '#fff', borderRadius: 20,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      Selected
                    </span>
                  )}
                </div>

                {sel && (
                  <div
                    style={{ borderTop: '1px solid #bae6fd', padding: '10px 14px', background: '#f0f9ff' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#0c4a6e', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Required Watch %
                        </div>
                        <input
                          type="number" min={0} max={100}
                          value={cfg.watch_pct}
                          onChange={e => updateMatConfig(m.id, 'watch_pct', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#0c4a6e', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Duration
                        </div>
                        <input
                          type="text"
                          value={cfg.duration_text}
                          placeholder="e.g. 10 min"
                          onChange={e => updateMatConfig(m.id, 'duration_text', e.target.value)}
                        />
                      </div>
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
