import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Syllabus, CourseModule, Lesson, Material, Quiz } from '../types'

const defaultRequirement: Record<string, string> = {
  video: 'Watch 90%', doc: 'Acknowledge read', quiz: 'Score ≥80%', eval: 'Complete all questions',
}
function materialToLessonType(t: string): 'video' | 'doc' | 'quiz' | 'eval' {
  if (t === 'Video') return 'video'
  if (t === 'Quiz') return 'quiz'
  if (t === 'Evaluation') return 'eval'
  return 'doc'
}

export default function SyllabusScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [syllabi, setSyllabi] = useState<Syllabus[]>([])
  const [selected, setSelected] = useState<Syllabus | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({})
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)

  useEffect(() => { fetchSyllabi() }, [])

  async function fetchSyllabi() {
    setListLoading(true)
    const { data } = await supabase.from('syllabi').select('*').order('created_at', { ascending: false })
    setSyllabi((data ?? []) as Syllabus[])
    setListLoading(false)
  }

  async function selectSyllabus(s: Syllabus) {
    setSelected(s)
    setLoading(true)
    const { data: mods } = await supabase.from('course_modules').select('*').eq('syllabus_id', s.id).order('order_index')
    const modList = (mods ?? []) as CourseModule[]
    setModules(modList)
    const lmap: Record<string, Lesson[]> = {}
    for (const m of modList) {
      const { data: ls } = await supabase.from('lessons').select('*').eq('module_id', m.id).order('order_index')
      lmap[m.id] = (ls ?? []) as Lesson[]
    }
    setLessons(lmap)
    setLoading(false)
  }

  function openCreateSyllabus() {
    openModal({
      title: 'Create Syllabus',
      body: (
        <SyllabusForm onSave={async d => {
          const { data } = await supabase.from('syllabi').insert(d).select().single()
          await fetchSyllabi()
          closeModal()
          toast('Syllabus created')
          if (data) selectSyllabus(data as Syllabus)
        }} />
      ),
    })
  }

  function openEditSyllabus(s: Syllabus) {
    openModal({
      title: 'Edit Syllabus',
      body: (
        <SyllabusForm initial={s} onSave={async d => {
          await supabase.from('syllabi').update(d).eq('id', s.id)
          await fetchSyllabi()
          setSelected(prev => prev?.id === s.id ? { ...prev, ...d } : prev)
          closeModal()
          toast('Syllabus updated')
        }} />
      ),
    })
  }

  async function deleteSyllabus(s: Syllabus) {
    if (!confirm(`Delete syllabus "${s.title}"? All its modules and lessons will be removed.`)) return
    await supabase.from('syllabi').delete().eq('id', s.id)
    await fetchSyllabi()
    if (selected?.id === s.id) { setSelected(null); setModules([]); setLessons({}) }
    toast('Syllabus deleted')
  }

  function openAddModule() {
    if (!selected) return
    openModal({
      title: 'Add Module',
      body: (
        <ModuleForm onSave={async d => {
          await supabase.from('course_modules').insert({ ...d, syllabus_id: selected.id, course_id: null, order_index: modules.length + 1 })
          selectSyllabus(selected); closeModal(); toast('Module added')
        }} />
      ),
    })
  }

  function openEditModule(mod: CourseModule) {
    openModal({
      title: 'Edit Module',
      body: (
        <ModuleForm initial={mod} onSave={async d => {
          await supabase.from('course_modules').update(d).eq('id', mod.id)
          if (selected) selectSyllabus(selected); closeModal(); toast('Module updated')
        }} />
      ),
    })
  }

  async function deleteModule(mod: CourseModule) {
    if (!confirm(`Delete module "${mod.title}" and all its lessons?`)) return
    await supabase.from('lessons').delete().eq('module_id', mod.id)
    await supabase.from('course_modules').delete().eq('id', mod.id)
    if (selected) selectSyllabus(selected)
    toast('Module deleted')
  }

  function openAddLesson(moduleId: string) {
    openModal({
      title: 'Add Lessons from Library',
      wide: true,
      body: (
        <MaterialPickerForm
          onSave={async items => {
            const base = (lessons[moduleId] ?? []).length
            for (let i = 0; i < items.length; i++) {
              const item = items[i]
              await supabase.from('lessons').insert({
                module_id: moduleId,
                title: item.title,
                type: item.lessonType,
                duration_text: item.duration || '',
                requirement: item.requirement || defaultRequirement[item.lessonType],
                material_id: item.materialId || null,
                quiz_id: item.quizId || null,
                order_index: base + i + 1,
              })
            }
            if (selected) selectSyllabus(selected)
            closeModal()
            toast(`${items.length} lesson${items.length !== 1 ? 's' : ''} added`)
          }}
        />
      ),
    })
  }

  function openEditLesson(lesson: Lesson) {
    openModal({
      title: 'Edit Lesson',
      wide: true,
      body: (
        <LessonEditForm initial={lesson} onSave={async d => {
          await supabase.from('lessons').update(d).eq('id', lesson.id)
          if (selected) selectSyllabus(selected); closeModal(); toast('Lesson updated')
        }} />
      ),
    })
  }

  async function deleteLesson(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return
    await supabase.from('lessons').delete().eq('id', lesson.id)
    if (selected) selectSyllabus(selected)
    toast('Lesson deleted')
  }

  const typeIcon: Record<string, string> = { video: '🎬', doc: '📄', quiz: '❓', eval: '📝' }
  const typeBadge: Record<string, string> = { video: 'badge-blue', doc: 'badge-teal', quiz: 'badge-amber', eval: 'badge-purple' }

  const totalLessons = Object.values(lessons).reduce((sum, ls) => sum + ls.length, 0)

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Syllabi</h1>
          <p className="screen-subtitle">Create reusable syllabi and link them to courses</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateSyllabus}>+ New Syllabus</button>
      </div>

      <div className="syllabus-layout">
        {/* ── Left panel: syllabi list ── */}
        <div className="syllabus-sidebar">
          <h4>All Syllabi</h4>
          {listLoading ? (
            <div className="loading-state" style={{ padding: 12 }}>Loading…</div>
          ) : syllabi.length === 0 ? (
            <div className="empty-state" style={{ padding: 12, fontSize: 13 }}>
              No syllabi yet.<br />Click <strong>+ New Syllabus</strong> to create one.
            </div>
          ) : syllabi.map(s => (
            <button
              key={s.id}
              className={`syllabus-course-item${selected?.id === s.id ? ' active' : ''}`}
              onClick={() => selectSyllabus(s)}
            >
              <div className="syllabus-course-title">{s.title}</div>
              <div className="syllabus-course-code">{s.description || 'No description'}</div>
            </button>
          ))}
        </div>

        {/* ── Right panel: selected syllabus content ── */}
        <div className="syllabus-content">
          {!selected ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              Select a syllabus from the list, or create a new one.
            </div>
          ) : (
            <>
              <div className="syllabus-content-header">
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{selected.title}</h2>
                  {selected.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{selected.description}</p>}
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {modules.length} module{modules.length !== 1 ? 's' : ''} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => openEditSyllabus(selected)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteSyllabus(selected)}>Delete</button>
                  <button className="btn btn-sm btn-primary" onClick={openAddModule}>+ Module</button>
                </div>
              </div>

              {loading ? (
                <div className="loading-state">Loading modules…</div>
              ) : modules.length === 0 ? (
                <div className="empty-state">No modules yet. Click <strong>+ Module</strong> to add one.</div>
              ) : modules.map(mod => (
                <div key={mod.id} className="module-block">
                  <div className="module-header">
                    <h3>{mod.title}</h3>
                    <div className="module-actions">
                      <button className="btn btn-sm" onClick={() => openAddLesson(mod.id)}>+ Lesson</button>
                      <button className="btn btn-sm btn-outline" onClick={() => openEditModule(mod)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteModule(mod)}>Delete</button>
                    </div>
                  </div>
                  <div className="lessons-list">
                    {(lessons[mod.id] ?? []).length === 0 ? (
                      <div style={{ padding: '10px 16px', fontSize: 13, color: 'var(--muted)' }}>
                        No lessons yet — click <strong>+ Lesson</strong> to add from the library.
                      </div>
                    ) : (lessons[mod.id] ?? []).map(lesson => (
                      <div key={lesson.id} className="lesson-row">
                        <span className="lesson-type-icon">{typeIcon[lesson.type] ?? '📌'}</span>
                        <div className="lesson-info">
                          <span className="lesson-title">{lesson.title}</span>
                          <span className="lesson-meta">
                            {lesson.duration_text} · {lesson.requirement}
                            {lesson.material_id && <span className="material-linked-tag">📎 from library</span>}
                          </span>
                        </div>
                        <span className={`badge ${typeBadge[lesson.type] ?? 'badge-gray'}`}>{lesson.type}</span>
                        <div className="lesson-row-actions">
                          <button className="btn btn-sm btn-outline" onClick={() => openEditLesson(lesson)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteLesson(lesson)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SyllabusForm ──────────────────────────────────────────────────────────────

function SyllabusForm({ initial, onSave }: { initial?: Partial<Syllabus>; onSave: (d: { title: string; description: string }) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title, description }) }}>
      <div className="form-group"><label>Syllabus Title</label><input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Hand Hygiene & Infection Control Syllabus" /></div>
      <div className="form-group"><label>Description (optional)</label><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this syllabus" /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Create Syllabus'}</button></div>
    </form>
  )
}

// ── ModuleForm ────────────────────────────────────────────────────────────────

function ModuleForm({ initial, onSave }: { initial?: Partial<CourseModule>; onSave: (d: { title: string }) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title }) }}>
      <div className="form-group"><label>Module Title</label><input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Module 1: Foundations" /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Add Module'}</button></div>
    </form>
  )
}

// ── MaterialPickerForm ────────────────────────────────────────────────────────

interface PickerItem {
  materialId?: string
  quizId?: string
  title: string
  lessonType: 'video' | 'doc' | 'quiz' | 'eval'
  duration: string
  requirement: string
}

const TYPE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'video', label: 'Video' },
  { key: 'doc', label: 'Document' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'eval', label: 'Evaluation' },
]
const MAT_TYPE_GROUPS: Record<string, string[]> = {
  video: ['Video'],
  doc: ['PDF', 'PPT', 'Checklist', 'Protocol', 'Image', 'Audio', 'Link/URL'],
  eval: ['Evaluation'],
}
const MAT_TYPE_ICON: Record<string, string> = {
  Video: '🎬', PDF: '📄', PPT: '📊', Checklist: '✅', Protocol: '📋',
  'Link/URL': '🔗', Image: '🖼️', Audio: '🎵', Evaluation: '📝', Quiz: '❓',
}

function MaterialPickerForm({ onSave }: { onSave: (items: PickerItem[]) => void }) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, PickerItem>>({})
  const [sharedDuration, setSharedDuration] = useState('')
  const [sharedReq, setSharedReq] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('id,title,type,size_text,file_url').order('title'),
      supabase.from('quizzes').select('id,title,pass_score,time_limit_min').order('title'),
    ]).then(([{ data: mats }, { data: qzs }]) => {
      setMaterials((mats ?? []) as Material[])
      setQuizzes((qzs ?? []) as Quiz[])
      setLoading(false)
    })
  }, [])

  function getDisplayItems() {
    const matItems = materials
      .filter(m => {
        if (tab === 'video') return MAT_TYPE_GROUPS.video.includes(m.type)
        if (tab === 'doc') return MAT_TYPE_GROUPS.doc.includes(m.type)
        if (tab === 'eval') return MAT_TYPE_GROUPS.eval.includes(m.type)
        if (tab === 'quiz') return false
        return true
      })
      .filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()))
      .map(m => ({
        id: `mat-${m.id}`,
        title: m.title,
        subtitle: [m.type, m.size_text, m.duration_text].filter(Boolean).join(' · '),
        lessonType: materialToLessonType(m.type),
        matId: m.id,
        quizId: '',
        // pre-fill from material metadata
        materialDuration: m.duration_text ?? '',
        materialReq: m.watch_pct_required != null && (m.type === 'Video' || m.type === 'Audio')
          ? `Watch ${m.watch_pct_required}%`
          : m.requires_acknowledgment
            ? 'Acknowledge read'
            : defaultRequirement[materialToLessonType(m.type)],
      }))

    const quizItems = (tab === 'quiz' || tab === 'all')
      ? quizzes.filter(q => !search || q.title.toLowerCase().includes(search.toLowerCase()))
          .map(q => ({
            id: `quiz-${q.id}`,
            title: q.title,
            subtitle: `Quiz · Pass ${q.pass_score}% · ${q.time_limit_min} min`,
            lessonType: 'quiz' as const,
            matId: '',
            quizId: q.id,
            materialDuration: `${q.time_limit_min} min`,
            materialReq: `Score ≥${q.pass_score}%`,
          }))
      : []

    return [...matItems, ...quizItems]
  }

  function toggle(item: ReturnType<typeof getDisplayItems>[0]) {
    setSelected(prev => {
      if (prev[item.id]) { const n = { ...prev }; delete n[item.id]; return n }
      return {
        ...prev,
        [item.id]: {
          materialId: item.matId || undefined,
          quizId: item.quizId || undefined,
          title: item.title,
          lessonType: item.lessonType,
          duration: item.materialDuration || '',
          requirement: item.materialReq || defaultRequirement[item.lessonType],
        },
      }
    })
  }

  const displayItems = getDisplayItems()
  const selectedCount = Object.keys(selected).length

  return (
    <div className="material-picker">
      <div className="material-picker-header">
        <p className="material-picker-hint">Select one or more items. Each becomes a lesson.</p>
        <div className="filter-chips" style={{ marginBottom: 8 }}>
          {TYPE_TABS.map(t => <button key={t.key} className={`chip${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>
        <input className="search-input" placeholder="Search materials…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="material-picker-list">
        {loading ? <div className="loading-state">Loading library…</div>
          : displayItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              {search ? 'No matches.' : 'No materials in this category yet. Upload in the Materials Library first.'}
            </div>
          ) : displayItems.map(item => {
            const mat = materials.find(m => `mat-${m.id}` === item.id)
            const isSelected = Boolean(selected[item.id])
            return (
              <label key={item.id} className={`material-picker-item${isSelected ? ' selected' : ''}`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(item)} className="material-picker-check" />
                <span className="material-picker-icon">{MAT_TYPE_ICON[mat?.type ?? 'Quiz'] ?? '📎'}</span>
                <div className="material-picker-info">
                  <span className="material-picker-title">{item.title}</span>
                  <span className="material-picker-subtitle">{item.subtitle}</span>
                </div>
                <span className={`badge badge-${item.lessonType === 'video' ? 'blue' : item.lessonType === 'doc' ? 'teal' : item.lessonType === 'quiz' ? 'amber' : 'purple'}`}>{item.lessonType}</span>
              </label>
            )
          })}
      </div>

      {selectedCount > 0 && (
        <div className="material-picker-footer">
          <div className="material-picker-selected-count">{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</div>
          <div className="form-row" style={{ margin: 0, gap: 8 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 11 }}>Duration (optional, applies to all)</label>
              <input value={sharedDuration} placeholder="e.g. 15 min" onChange={e => setSharedDuration(e.target.value)} style={{ padding: '5px 8px', fontSize: 12 }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 11 }}>Requirement (optional, applies to all)</label>
              <input value={sharedReq} placeholder="e.g. Watch 90%" onChange={e => setSharedReq(e.target.value)} style={{ padding: '5px 8px', fontSize: 12 }} />
            </div>
          </div>
        </div>
      )}

      <div className="modal-form-actions">
        <button type="button" className="btn btn-primary" disabled={selectedCount === 0} onClick={() => onSave(Object.values(selected).map(s => ({ ...s, duration: sharedDuration || s.duration, requirement: sharedReq || s.requirement })))}>
          Add {selectedCount > 0 ? selectedCount : ''} Lesson{selectedCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

// ── LessonEditForm ────────────────────────────────────────────────────────────

function LessonEditForm({ initial, onSave }: { initial: Lesson; onSave: (d: Partial<Lesson>) => void }) {
  const [title, setTitle] = useState(initial.title)
  const [duration, setDuration] = useState(initial.duration_text)
  const [requirement, setRequirement] = useState(initial.requirement)
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title, duration_text: duration, requirement }) }}>
      <div className="form-group"><label>Title</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
      <div className="form-row">
        <div className="form-group"><label>Duration</label><input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 15 min" /></div>
        <div className="form-group"><label>Requirement</label><input value={requirement} onChange={e => setRequirement(e.target.value)} placeholder="e.g. Watch 90%" /></div>
      </div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Save Changes</button></div>
    </form>
  )
}
