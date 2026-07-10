import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { COURSES } from '../data/constants'
import type { Course, CourseModule, Lesson, Quiz } from '../types'

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
      title: 'Add Lesson',
      wide: true,
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
      wide: true,
      body: <LessonForm initial={lesson} onSave={async d => {
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
                {(lessons[mod.id] ?? []).map(lesson => (
                  <div key={lesson.id} className="lesson-row">
                    <span className="lesson-type-icon">{typeIcon[lesson.type] ?? '📌'}</span>
                    <div className="lesson-info">
                      <span className="lesson-title">{lesson.title}</span>
                      <span className="lesson-meta">{lesson.duration_text} · {lesson.requirement}</span>
                    </div>
                    <span className={`badge badge-${lesson.type === 'video' ? 'blue' : lesson.type === 'doc' ? 'teal' : lesson.type === 'quiz' ? 'amber' : 'purple'}`}>{lesson.type}</span>
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

function ModuleForm({ initial, onSave }: { initial?: Partial<CourseModule>; onSave: (d: { title: string }) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ title }) }}>
      <div className="form-group"><label>Module Title</label><input value={title} onChange={e => setTitle(e.target.value)} required /></div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Add'}</button></div>
    </form>
  )
}

function LessonForm({ initial, onSave }: { initial?: Partial<Lesson>; onSave: (d: Partial<Lesson>) => void }) {
  const [form, setForm] = useState(() => {
    const base = { title: '', type: 'video' as 'video'|'doc'|'quiz'|'eval', duration_text: '', requirement: '', video_url: '', doc_url: '', doc_filename: '', quiz_id: '' }
    if (!initial) return base
    return {
      ...base,
      ...initial,
      video_url: initial.video_url ?? '',
      doc_url: initial.doc_url ?? '',
      doc_filename: initial.doc_filename ?? '',
      quiz_id: initial.quiz_id ?? '',
    }
  })

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const videoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('quizzes').select('id,title').order('title').then(({ data }) => {
      if (data) setQuizzes(data as Quiz[])
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUploadError('')
    let videoUrl = form.video_url
    let docUrl = form.doc_url
    let docFilename = form.doc_filename

    try {
      setUploading(true)
      if (videoFile) {
        const path = `courses/${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error } = await supabase.storage.from('course-videos').upload(path, videoFile, { upsert: true })
        if (error) throw new Error(`Video upload failed: ${error.message}`)
        videoUrl = supabase.storage.from('course-videos').getPublicUrl(path).data.publicUrl
      }
      if (docFile) {
        const path = `${Date.now()}-${docFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error } = await supabase.storage.from('materials').upload(path, docFile, { upsert: true })
        if (error) throw new Error(`Document upload failed: ${error.message}`)
        docUrl = supabase.storage.from('materials').getPublicUrl(path).data.publicUrl
        docFilename = docFile.name
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
      return
    }

    setUploading(false)
    onSave({
      title: form.title,
      type: form.type,
      duration_text: form.duration_text,
      requirement: form.requirement,
      video_url: videoUrl || undefined,
      doc_url: docUrl || undefined,
      doc_filename: docFilename || undefined,
      quiz_id: form.quiz_id || undefined,
    })
  }

  const defaultRequirement: Record<string, string> = {
    video: 'Watch 90%', doc: 'Acknowledge read', quiz: 'Score ≥80%', eval: 'Complete all questions',
  }

  function handleTypeChange(t: 'video'|'doc'|'quiz'|'eval') {
    set('type', t)
    if (!form.requirement) set('requirement', defaultRequirement[t])
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Title</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} required />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Type</label>
          <select value={form.type} onChange={e => handleTypeChange(e.target.value as 'video'|'doc'|'quiz'|'eval')}>
            <option value="video">Video</option>
            <option value="doc">Document</option>
            <option value="quiz">Quiz</option>
            <option value="eval">Evaluation</option>
          </select>
        </div>
        <div className="form-group">
          <label>Duration</label>
          <input
            value={form.duration_text}
            placeholder={form.type === 'video' ? '12 min' : form.type === 'doc' ? '10 min read' : '15 min'}
            onChange={e => set('duration_text', e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Requirement</label>
        <input
          value={form.requirement}
          placeholder={defaultRequirement[form.type]}
          onChange={e => set('requirement', e.target.value)}
        />
      </div>

      {form.type === 'video' && (
        <div className="form-section">
          <div className="form-section-label">Video Content</div>
          <div className="form-group">
            <label>Upload Video File</label>
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              onChange={e => { setVideoFile(e.target.files?.[0] ?? null); set('video_url', '') }}
            />
            {videoFile && (
              <div className="upload-preview">
                <span>📹 {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { setVideoFile(null); if (videoRef.current) videoRef.current.value = '' }}>Remove</button>
              </div>
            )}
          </div>
          {!videoFile && (
            <div className="form-group">
              <label>{initial?.video_url ? 'Replace video URL' : 'Or paste a video URL'}</label>
              <input
                type="url"
                value={form.video_url}
                placeholder="https://example.com/video.mp4"
                onChange={e => set('video_url', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {form.type === 'doc' && (
        <div className="form-section">
          <div className="form-section-label">Document Content</div>
          <div className="form-group">
            <label>Upload Document</label>
            <input
              ref={docRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              onChange={e => { setDocFile(e.target.files?.[0] ?? null); set('doc_url', '') }}
            />
            {docFile && (
              <div className="upload-preview">
                <span>📄 {docFile.name} ({(docFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { setDocFile(null); if (docRef.current) docRef.current.value = '' }}>Remove</button>
              </div>
            )}
          </div>
          {!docFile && (
            <div className="form-group">
              <label>{initial?.doc_url ? 'Replace document URL' : 'Or paste a document URL'}</label>
              <input
                type="url"
                value={form.doc_url}
                placeholder="https://example.com/document.pdf"
                onChange={e => set('doc_url', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {form.type === 'quiz' && (
        <div className="form-section">
          <div className="form-section-label">Quiz</div>
          <div className="form-group">
            <label>Select Quiz</label>
            <select value={form.quiz_id} onChange={e => set('quiz_id', e.target.value)}>
              <option value="">— Choose a quiz —</option>
              {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
            {quizzes.length === 0 && (
              <span className="form-hint">No quizzes yet — create one in the Quizzes section first.</span>
            )}
          </div>
        </div>
      )}

      {uploadError && <div className="form-error">{uploadError}</div>}

      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? 'Uploading…' : initial ? 'Save Changes' : 'Add Lesson'}
        </button>
      </div>
    </form>
  )
}
