import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { COURSES } from '../data/constants'
import type { Course, CourseModule, Lesson, Material, Quiz } from '../types'

// Maps material type strings to lesson types
function materialToLessonType(matType: string): 'video' | 'doc' | 'quiz' | 'eval' {
  if (matType === 'Video') return 'video'
  if (matType === 'Quiz') return 'quiz'
  if (matType === 'Evaluation') return 'eval'
  return 'doc'
}

const defaultRequirement: Record<string, string> = {
  video: 'Watch 90%', doc: 'Acknowledge read', quiz: 'Score ≥80%', eval: 'Complete all questions',
}

export default function SyllabusScreen() {
  const { params, toast, openModal, closeModal } = useApp()
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('courses').select('*').order('title')
      const list = (data && data.length > 0) ? data : COURSES
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
    for (const m of modList) {
      const { data: ls } = await supabase.from('lessons').select('*').eq('module_id', m.id).order('order_index')
      lessonMap[m.id] = ls ?? []
    }
    if (modList.length === 0) {
      setModules([{ id: 'm1', course_id: course.id, title: 'Module 1: Introduction', order_index: 1 },
                  { id: 'm2', course_id: course.id, title: 'Module 2: Core Concepts', order_index: 2 }])
      lessonMap['m1'] = [
        { id: 'l1', module_id: 'm1', type: 'video', title: 'Introduction Video', duration_text: '12 min', requirement: 'Watch 90%', order_index: 1 },
        { id: 'l2', module_id: 'm1', type: 'doc', title: 'Overview Document', duration_text: '5 min read', requirement: 'Read all pages', order_index: 2 },
      ]
      lessonMap['m2'] = [
        { id: 'l3', module_id: 'm2', type: 'quiz', title: 'Knowledge Check', duration_text: '15 min', requirement: 'Score ≥80%', order_index: 1 },
        { id: 'l4', module_id: 'm2', type: 'eval', title: 'Final Evaluation', duration_text: '30 min', requirement: 'Complete all', order_index: 2 },
      ]
    }
    setLessons(lessonMap)
    setLoading(false)
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

  async function deleteModule(mod: CourseModule) {
    if (!confirm(`Delete module "${mod.title}" and all its lessons?`)) return
    await supabase.from('lessons').delete().eq('module_id', mod.id)
    await supabase.from('course_modules').delete().eq('id', mod.id)
    if (selectedCourse) loadCourse(selectedCourse)
    toast('Module deleted')
  }

  function openAddLesson(moduleId: string) {
    openModal({
      title: 'Add Lessons from Library',
      wide: true,
      body: (
        <MaterialPickerForm
          onSave={async (items) => {
            const base = (lessons[moduleId] ?? []).length
            const rows = items.map((item, i) => ({
              module_id: moduleId,
              title: item.title,
              type: item.lessonType,
              duration_text: item.duration,
              requirement: item.requirement || defaultRequirement[item.lessonType],
              material_id: item.materialId || null,
              quiz_id: item.quizId || null,
              order_index: base + i + 1,
            }))
            for (const row of rows) {
              await supabase.from('lessons').insert(row)
            }
            if (selectedCourse) loadCourse(selectedCourse)
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
      body: <LessonEditForm initial={lesson} onSave={async d => {
        await supabase.from('lessons').update(d).eq('id', lesson.id)
        if (selectedCourse) loadCourse(selectedCourse); closeModal(); toast('Lesson updated')
      }} />,
    })
  }

  async function deleteLesson(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return
    await supabase.from('lessons').delete().eq('id', lesson.id)
    if (selectedCourse) loadCourse(selectedCourse)
    toast('Lesson deleted')
  }

  const typeIcon: Record<string, string> = { video: '🎬', doc: '📄', quiz: '❓', eval: '📝' }
  const typeBadge: Record<string, string> = { video: 'badge-blue', doc: 'badge-teal', quiz: 'badge-amber', eval: 'badge-purple' }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Syllabus Builder</h1>
          <p className="screen-subtitle">Manage course modules and lessons</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModule} disabled={!selectedCourse}>+ Add Module</button>
      </div>

      <div className="syllabus-layout">
        <div className="syllabus-sidebar">
          <h4>Courses</h4>
          {courses.map(c => (
            <button key={c.id} className={`syllabus-course-item${selectedCourse?.id === c.id ? ' active' : ''}`} onClick={() => loadCourse(c)}>
              <div className="syllabus-course-title">{c.title}</div>
              <div className="syllabus-course-code">{c.code}</div>
            </button>
          ))}
        </div>

        <div className="syllabus-content">
          {loading ? <div className="loading-state">Loading…</div> : modules.length === 0 ? (
            <div className="empty-state">No modules yet. Add a module to get started.</div>
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
                  <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted)' }}>
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
        </div>
      </div>
    </div>
  )
}

// ── ModuleForm ────────────────────────────────────────────────────────────────

function ModuleForm({ initial, onSave }: { initial?: Partial<CourseModule>; onSave: (d: { title: string }) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title }) }}>
      <div className="form-group"><label>Module Title</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Add'}</button></div>
    </form>
  )
}

// ── MaterialPickerForm — multi-select from library ────────────────────────────

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

  function getTabMaterials(): Array<{ id: string; title: string; subtitle: string; lessonType: 'video'|'doc'|'quiz'|'eval'; isQuiz?: boolean }> {
    const matItems = materials
      .filter(m => {
        if (tab === 'video') return MAT_TYPE_GROUPS.video.includes(m.type)
        if (tab === 'doc') return MAT_TYPE_GROUPS.doc.includes(m.type)
        if (tab === 'eval') return MAT_TYPE_GROUPS.eval.includes(m.type)
        if (tab === 'quiz') return false
        return true // 'all' — include materials (not quizzes)
      })
      .filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()))
      .map(m => ({
        id: `mat-${m.id}`,
        title: m.title,
        subtitle: `${m.type}${m.size_text ? ` · ${m.size_text}` : ''}`,
        lessonType: materialToLessonType(m.type) as 'video'|'doc'|'quiz'|'eval',
        isQuiz: false,
      }))

    const quizItems = (tab === 'quiz' || tab === 'all')
      ? quizzes
          .filter(q => !search || q.title.toLowerCase().includes(search.toLowerCase()))
          .map(q => ({
            id: `quiz-${q.id}`,
            title: q.title,
            subtitle: `Quiz · Pass ${q.pass_score}% · ${q.time_limit_min} min`,
            lessonType: 'quiz' as const,
            isQuiz: true,
          }))
      : []

    return [...matItems, ...quizItems]
  }

  function toggleItem(item: ReturnType<typeof getTabMaterials>[0], mat?: Material, quiz?: Quiz) {
    setSelected(prev => {
      if (prev[item.id]) {
        const next = { ...prev }
        delete next[item.id]
        return next
      }
      return {
        ...prev,
        [item.id]: {
          materialId: mat ? mat.id : undefined,
          quizId: quiz ? quiz.id : undefined,
          title: item.title,
          lessonType: item.lessonType,
          duration: sharedDuration || defaultRequirement[item.lessonType] ? '' : '',
          requirement: sharedReq || defaultRequirement[item.lessonType],
        },
      }
    })
  }

  function handleSave() {
    const items = Object.values(selected).map(s => ({
      ...s,
      duration: sharedDuration || s.duration,
      requirement: sharedReq || s.requirement || defaultRequirement[s.lessonType],
    }))
    onSave(items)
  }

  const displayItems = getTabMaterials()
  const selectedCount = Object.keys(selected).length

  return (
    <div className="material-picker">
      <div className="material-picker-header">
        <p className="material-picker-hint">
          Select one or more items from your library. Each item will become a lesson.
        </p>
        <div className="filter-chips" style={{ marginBottom: 8 }}>
          {TYPE_TABS.map(t => (
            <button key={t.key} className={`chip${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          placeholder="Search materials…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="material-picker-list">
        {loading ? (
          <div className="loading-state">Loading library…</div>
        ) : displayItems.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            {search ? 'No matches found.' : 'No materials in this category yet. Upload some in the Materials Library first.'}
          </div>
        ) : displayItems.map(item => {
          const mat = materials.find(m => `mat-${m.id}` === item.id)
          const quiz = quizzes.find(q => `quiz-${q.id}` === item.id)
          const isSelected = Boolean(selected[item.id])
          return (
            <label key={item.id} className={`material-picker-item${isSelected ? ' selected' : ''}`}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleItem(item, mat, quiz)}
                className="material-picker-check"
              />
              <span className="material-picker-icon">{MAT_TYPE_ICON[mat?.type ?? 'Quiz'] ?? '📎'}</span>
              <div className="material-picker-info">
                <span className="material-picker-title">{item.title}</span>
                <span className="material-picker-subtitle">{item.subtitle}</span>
              </div>
              <span className={`badge badge-${item.lessonType === 'video' ? 'blue' : item.lessonType === 'doc' ? 'teal' : item.lessonType === 'quiz' ? 'amber' : 'purple'}`}>
                {item.lessonType}
              </span>
            </label>
          )
        })}
      </div>

      {selectedCount > 0 && (
        <div className="material-picker-footer">
          <div className="material-picker-selected-count">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </div>
          <div className="form-row" style={{ margin: 0, gap: 8 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 11 }}>Duration (optional, applies to all)</label>
              <input
                value={sharedDuration}
                placeholder="e.g. 15 min"
                onChange={e => setSharedDuration(e.target.value)}
                style={{ padding: '5px 8px', fontSize: 12 }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 11 }}>Requirement (optional, applies to all)</label>
              <input
                value={sharedReq}
                placeholder="e.g. Watch 90%"
                onChange={e => setSharedReq(e.target.value)}
                style={{ padding: '5px 8px', fontSize: 12 }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="modal-form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={selectedCount === 0}
          onClick={handleSave}
        >
          Add {selectedCount > 0 ? selectedCount : ''} Lesson{selectedCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

// ── LessonEditForm — for editing an existing lesson ───────────────────────────

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
