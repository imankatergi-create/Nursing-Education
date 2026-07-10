import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { COURSES } from '../data/constants'
import type { Course, CourseModule, Lesson } from '../types'

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

  const typeIcon: Record<string, string> = { video: '🎬', doc: '📄', quiz: '❓', eval: '📝' }

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
                <button className="btn btn-sm" onClick={() => openAddLesson(mod.id)}>+ Lesson</button>
              </div>
              <div className="lessons-list">
                {(lessons[mod.id] ?? []).map(lesson => (
                  <div key={lesson.id} className="lesson-row">
                    <span className="lesson-type-icon">{typeIcon[lesson.type] ?? '📌'}</span>
                    <div className="lesson-info">
                      <span className="lesson-title">{lesson.title}</span>
                      <span className="lesson-meta">{lesson.duration_text} · {lesson.requirement}</span>
                    </div>
                    <span className={`badge badge-${lesson.type === 'video' ? 'blue' : lesson.type === 'doc' ? 'teal' : lesson.type === 'quiz' ? 'amber' : 'purple'}`}>{lesson.type}</span>
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

function ModuleForm({ onSave }: { onSave: (d: { title: string }) => void }) {
  const [title, setTitle] = useState('')
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title }) }}>
      <div className="form-group"><label>Module Title</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Add</button></div>
    </form>
  )
}

function LessonForm({ onSave }: { onSave: (d: Partial<Lesson>) => void }) {
  const [form, setForm] = useState<{ title: string; type: 'video'|'doc'|'quiz'|'eval'; duration_text: string; requirement: string }>({ title: '', type: 'video', duration_text: '', requirement: '' })
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required /></div>
      <div className="form-row">
        <div className="form-group"><label>Type</label>
          <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value as 'video'|'doc'|'quiz'|'eval'}))}>
            <option value="video">Video</option><option value="doc">Document</option><option value="quiz">Quiz</option><option value="eval">Evaluation</option>
          </select>
        </div>
        <div className="form-group"><label>Duration</label><input value={form.duration_text} onChange={e => setForm(f => ({...f, duration_text: e.target.value}))} /></div>
      </div>
      <div className="form-group"><label>Requirement</label><input value={form.requirement} onChange={e => setForm(f => ({...f, requirement: e.target.value}))} /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Add Lesson</button></div>
    </form>
  )
}
