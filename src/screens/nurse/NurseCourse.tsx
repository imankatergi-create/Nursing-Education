import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { COURSES } from '../../data/constants'
import type { Course, CourseModule, Lesson } from '../../types'

// ── Fallback demo data (used only when a course has no syllabus built yet) ────
const DEMO_MODULES: CourseModule[] = [
  { id: 'm1', course_id: '', title: 'Module 1: Foundations', order_index: 1 },
  { id: 'm2', course_id: '', title: 'Module 2: Core Procedures', order_index: 2 },
  { id: 'm3', course_id: '', title: 'Module 3: Assessment', order_index: 3 },
]
const DEMO_LESSONS: Record<string, Lesson[]> = {
  m1: [
    { id: 'l1', module_id: 'm1', type: 'video', title: 'Introduction & Overview', duration_text: '12 min', requirement: 'Watch 90%', order_index: 1 },
    { id: 'l2', module_id: 'm1', type: 'doc', title: 'Reference Guide (PDF)', duration_text: '10 min read', requirement: 'Acknowledge read', order_index: 2 },
  ],
  m2: [
    { id: 'l3', module_id: 'm2', type: 'video', title: 'Step-by-Step Procedure', duration_text: '18 min', requirement: 'Watch 100%', order_index: 1 },
    { id: 'l4', module_id: 'm2', type: 'doc', title: 'Protocol Checklist', duration_text: '5 min read', requirement: 'Download required', order_index: 2 },
    { id: 'l5', module_id: 'm2', type: 'quiz', title: 'Knowledge Check Quiz', duration_text: '15 min', requirement: 'Score ≥80%', order_index: 3 },
  ],
  m3: [
    { id: 'l6', module_id: 'm3', type: 'eval', title: 'Final Evaluation', duration_text: '30 min', requirement: 'Complete all questions', order_index: 1 },
  ],
}

interface LessonRow {
  lesson_key: string
  type: string
  watch_pct: number
  doc_page: number
  doc_total_pages: number
  doc_acked: boolean
  quiz_score: number | null
  quiz_passed: boolean | null
  completed: boolean
}

type LessonStatus = 'done' | 'inprog' | 'todo' | 'locked'

export default function NurseCourse() {
  const { params, navigate, profile } = useApp()
  const courseId = params.courseId ?? ''
  const profileId = profile!.id

  const [course, setCourse] = useState<Course>(COURSES.find(c => c.id === courseId) ?? COURSES[0])
  const [modules, setModules] = useState<CourseModule[]>([])
  const [lessonMap, setLessonMap] = useState<Record<string, Lesson[]>>({})
  const [allLessonIds, setAllLessonIds] = useState<string[]>([])
  const [materialUrlMap, setMaterialUrlMap] = useState<Record<string, { file_url?: string; type?: string }>>({})
  const [syllabusLoading, setSyllabusLoading] = useState(true)

  const [progressMap, setProgressMap] = useState<Record<string, LessonRow>>({})
  const [loadingProgress, setLoadingProgress] = useState(true)

  // Load course metadata from DB
  useEffect(() => {
    supabase.from('courses').select('*').eq('id', courseId).maybeSingle().then(({ data }) => {
      if (data) setCourse(data as Course)
    })
  }, [courseId])

  // Load syllabus (modules + lessons) from DB
  useEffect(() => {
    loadSyllabus()
  }, [courseId])

  async function loadSyllabus() {
    setSyllabusLoading(true)

    // First, load the course to check if it has a syllabus_id
    const { data: courseData } = await supabase.from('courses').select('syllabus_id').eq('id', courseId).maybeSingle()
    const syllabusId = (courseData as { syllabus_id?: string | null } | null)?.syllabus_id

    // Load modules from the linked syllabus (if set), otherwise from the course directly
    const modsQuery = syllabusId
      ? supabase.from('course_modules').select('*').eq('syllabus_id', syllabusId).order('order_index')
      : supabase.from('course_modules').select('*').eq('course_id', courseId).order('order_index')

    const { data: mods } = await modsQuery

    if (mods && mods.length > 0) {
      const lmap: Record<string, Lesson[]> = {}
      const ids: string[] = []
      const materialIds: string[] = []
      for (const m of mods) {
        const { data: ls } = await supabase
          .from('lessons')
          .select('*')
          .eq('module_id', m.id)
          .order('order_index')
        const lessons = (ls ?? []) as Lesson[]
        lmap[m.id] = lessons
        for (const l of lessons) {
          ids.push(l.id)
          if (l.material_id) materialIds.push(l.material_id)
        }
      }
      // Load material file URLs in one query
      if (materialIds.length > 0) {
        const { data: mats } = await supabase
          .from('materials')
          .select('id,file_url,type')
          .in('id', materialIds)
        const urlMap: Record<string, { file_url?: string; type?: string }> = {}
        for (const mat of mats ?? []) urlMap[mat.id] = { file_url: mat.file_url, type: mat.type }
        setMaterialUrlMap(urlMap)
      }
      setModules(mods as CourseModule[])
      setLessonMap(lmap)
      setAllLessonIds(ids)
    } else {
      // No syllabus built yet — show demo data
      setModules(DEMO_MODULES)
      setLessonMap(DEMO_LESSONS)
      setAllLessonIds(['l1', 'l2', 'l3', 'l4', 'l5', 'l6'])
    }
    setSyllabusLoading(false)
  }

  useEffect(() => {
    if (!syllabusLoading && allLessonIds.length > 0) loadProgress()
  }, [courseId, profileId, params.view, syllabusLoading, allLessonIds.length])

  async function loadProgress() {
    setLoadingProgress(true)
    const { data } = await supabase
      .from('lesson_progress')
      .select('lesson_key,type,watch_pct,doc_page,doc_total_pages,doc_acked,quiz_score,quiz_passed,completed')
      .eq('profile_id', profileId)
      .eq('course_key', courseId)
    if (data) {
      const map: Record<string, LessonRow> = {}
      for (const row of data) map[row.lesson_key] = row
      setProgressMap(map)
      const allDone = allLessonIds.length > 0 && allLessonIds.every(id => map[id]?.completed)
      if (allDone) await maybeIssueCertificate(map)
    }
    setLoadingProgress(false)
  }

  async function maybeIssueCertificate(map: Record<string, LessonRow>) {
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('profile_id', profileId)
      .eq('course_id', courseId)
      .maybeSingle()
    if (existing) return

    const scores = Object.values(map).filter(r => r.quiz_score != null).map(r => r.quiz_score as number)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100

    const certNo = `CERT-${Date.now().toString(36).toUpperCase()}`
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 2)

    await supabase.from('certificates').insert({
      cert_no: certNo, profile_id: profileId, course_id: courseId, course_name: course.title,
      issued_at: new Date().toISOString(), score_pct: `${avgScore}%`,
      expiry_date: expiryDate.toISOString().split('T')[0], status: 'Valid',
      verify_code: Math.random().toString(36).substring(2, 10).toUpperCase(), issued_by: 'System',
    })

    await supabase.from('nurse_enrollments')
      .update({ status: 'completed', completion_pct: 100, last_activity: 'Completed' })
      .eq('profile_id', profileId).eq('course_id', courseId)
  }

  function getLessonStatus(id: string): LessonStatus {
    const p = progressMap[id]
    if (p?.completed) return 'done'
    const idx = allLessonIds.indexOf(id)
    if (idx > 0) {
      const prev = progressMap[allLessonIds[idx - 1]]
      if (!prev?.completed) return 'locked'
    }
    if ((p?.watch_pct ?? 0) > 0 || (p?.doc_page ?? 1) > 1) return 'inprog'
    return 'todo'
  }

  function getLessonForId(id: string): Lesson | undefined {
    for (const lessons of Object.values(lessonMap)) {
      const found = lessons.find(l => l.id === id)
      if (found) return found
    }
  }

  function openLesson(lesson: Lesson) {
    const st = getLessonStatus(lesson.id)
    if (st === 'locked') return
    const dest = lesson.type === 'video' ? 'video' : lesson.type === 'doc' ? 'doc' : 'quiz'
    navigate('ncourse', { ...params, view: dest, lessonId: lesson.id })
  }

  const backToCourse = () => navigate('ncourse', { courseId })

  const currentLesson = params.lessonId ? getLessonForId(params.lessonId) : undefined

  // Resolve the actual content URL: prefer material file_url over lesson-level fields
  function resolveContentUrl(lesson?: Lesson): string | undefined {
    if (!lesson) return undefined
    if (lesson.material_id && materialUrlMap[lesson.material_id]?.file_url) {
      return materialUrlMap[lesson.material_id].file_url
    }
    return lesson.video_url ?? lesson.doc_url
  }

  if (params.view === 'video') return (
    <VideoPlayer
      course={course}
      lesson={currentLesson}
      resolvedUrl={resolveContentUrl(currentLesson)}
      courseId={courseId}
      lessonId={params.lessonId ?? ''}
      profileId={profileId}
      initialProgress={progressMap[params.lessonId ?? '']?.watch_pct ?? 0}
      onBack={backToCourse}
      onCompleted={loadProgress}
    />
  )
  if (params.view === 'doc') return (
    <DocViewer
      lesson={currentLesson}
      resolvedUrl={resolveContentUrl(currentLesson)}
      courseId={courseId}
      lessonId={params.lessonId ?? ''}
      profileId={profileId}
      initialPage={progressMap[params.lessonId ?? '']?.doc_page ?? 1}
      initialAcked={progressMap[params.lessonId ?? '']?.doc_acked ?? false}
      onBack={backToCourse}
      onCompleted={loadProgress}
    />
  )
  if (params.view === 'quiz') return (
    <QuizPlayer
      course={course}
      courseId={courseId}
      lessonId={params.lessonId ?? ''}
      profileId={profileId}
      initialScore={progressMap[params.lessonId ?? '']?.quiz_score ?? null}
      onBack={backToCourse}
      onCompleted={loadProgress}
    />
  )

  const doneCount = allLessonIds.filter(id => progressMap[id]?.completed).length
  const totalLessons = allLessonIds.length
  const coursePct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0

  const typeIcon: Record<string, string> = { video: '🎬', doc: '📄', quiz: '❓', eval: '📝' }
  const statusIcon: Record<LessonStatus, string> = { done: '✅', inprog: '▶️', todo: '⭕', locked: '🔒' }
  const statusColor: Record<LessonStatus, string> = { done: 'badge-green', inprog: 'badge-blue', todo: 'badge-gray', locked: 'badge-gray' }

  return (
    <div className="screen-container">
      <div className="back-nav">
        <button className="btn btn-sm btn-outline" onClick={() => navigate('ncourses')}>← Back to Courses</button>
      </div>

      <div className="course-hero">
        <div className="course-hero-icon" style={{ background: '#0891b2' }}>📚</div>
        <div className="course-hero-info">
          <span className="course-code">{course.code}</span>
          <h1 className="course-hero-title">{course.title}</h1>
          <div className="course-hero-meta">
            <span>👨‍🏫 {course.instructor}</span>
            <span>⏱ {course.duration}</span>
            <span>📊 {course.level}</span>
            <span>🌐 {course.lang}</span>
          </div>
          <div className="course-hero-progress">
            <div className="bar-track" style={{ maxWidth: 300 }}>
              <div className="bar-fill" style={{ width: `${coursePct}%` }} />
            </div>
            <span>
              {loadingProgress || syllabusLoading
                ? 'Loading…'
                : `${coursePct}% complete (${doneCount}/${totalLessons} lessons)`}
            </span>
          </div>
        </div>
      </div>

      <div className="course-objectives">
        <h3>Course Objectives</h3>
        <ul>{course.objectives?.map((o, i) => <li key={i}>{o}</li>)}</ul>
      </div>

      <div className="syllabus-modules">
        {syllabusLoading ? (
          <div className="loading-state">Loading syllabus…</div>
        ) : modules.map(mod => (
          <div key={mod.id} className="module-block">
            <div className="module-header"><h3>{mod.title}</h3></div>
            <div className="lessons-list">
              {(lessonMap[mod.id] ?? []).length === 0 ? (
                <div className="empty-state" style={{ padding: '12px 14px', fontSize: 13 }}>No lessons in this module yet.</div>
              ) : (lessonMap[mod.id] ?? []).map(lesson => {
                const st = getLessonStatus(lesson.id)
                const locked = st === 'locked'
                const p = progressMap[lesson.id]
                return (
                  <div
                    key={lesson.id}
                    className={`lesson-row clickable${locked ? ' locked' : ''}`}
                    onClick={() => openLesson(lesson)}
                  >
                    <span className="lesson-status-icon">{statusIcon[st]}</span>
                    <span className="lesson-type-icon">{typeIcon[lesson.type] ?? '📌'}</span>
                    <div className="lesson-info">
                      <span className="lesson-title">{lesson.title}</span>
                      <span className="lesson-meta">{lesson.duration_text} · {lesson.requirement}</span>
                      {lesson.type === 'video' && (p?.watch_pct ?? 0) > 0 && !p?.completed && (
                        <span className="lesson-sub-progress">{p!.watch_pct}% watched</span>
                      )}
                      {lesson.type === 'doc' && (p?.doc_page ?? 1) > 1 && !p?.completed && (
                        <span className="lesson-sub-progress">Page {p!.doc_page}/{p!.doc_total_pages} read</span>
                      )}
                      {lesson.type === 'quiz' && p?.quiz_score != null && (
                        <span className="lesson-sub-progress">Best score: {p.quiz_score}% {p.quiz_passed ? '✅' : '❌'}</span>
                      )}
                      {locked && <span className="lesson-locked-note">Complete the previous lesson to unlock</span>}
                    </div>
                    <span className={`badge ${statusColor[st]}`}>{st}</span>
                    {!locked && <span className="lesson-arrow">›</span>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── VideoPlayer ────────────────────────────────────────────────────────────

function VideoPlayer({
  course, lesson, resolvedUrl, courseId, lessonId, profileId, initialProgress, onBack, onCompleted,
}: {
  course: Course
  lesson?: Lesson
  resolvedUrl?: string
  courseId: string
  lessonId: string
  profileId: string
  initialProgress: number
  onBack: () => void
  onCompleted: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [progress, setProgress] = useState(initialProgress)
  const [playing, setPlaying] = useState(false)
  const [pauses, setPauses] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [totalTime, setTotalTime] = useState('0:00')
  const progressRef = useRef(progress)
  const alreadyCompleted = useRef(initialProgress >= 90)
  progressRef.current = progress

  // resolvedUrl takes priority (material file_url), then lesson-level, then course-level
  const videoUrl = resolvedUrl ?? lesson?.video_url ?? course.video_url
  const hasRealVideo = Boolean(videoUrl)

  function onTimeUpdate() {
    const el = videoRef.current
    if (!el || !el.duration) return
    const pct = Math.round((el.currentTime / el.duration) * 100)
    setProgress(pct)
    setCurrentTime(formatTime(el.currentTime))
    progressRef.current = pct
  }

  function onLoadedMetadata() {
    const el = videoRef.current
    if (!el) return
    setTotalTime(formatTime(el.duration))
    if (initialProgress > 0 && initialProgress < 100) {
      el.currentTime = (initialProgress / 100) * el.duration
    }
  }

  function onPlay() { setPlaying(true) }

  function onPause() {
    setPlaying(false)
    setPauses(p => p + 1)
    saveVideoProgress(progressRef.current, progressRef.current >= 90)
  }

  function onEnded() {
    setPlaying(false)
    saveVideoProgress(100, true).then(onCompleted)
  }

  useEffect(() => {
    if (hasRealVideo) return
    let interval: ReturnType<typeof setInterval>
    if (playing && progress < 100) {
      interval = setInterval(() => setProgress(p => Math.min(p + 1, 100)), 300)
    }
    return () => clearInterval(interval)
  }, [playing, progress, hasRealVideo])

  useEffect(() => {
    if (hasRealVideo) return
    if (progress >= 90 && !alreadyCompleted.current) {
      alreadyCompleted.current = true
      saveVideoProgress(progress, true).then(onCompleted)
    }
  }, [progress, hasRealVideo])

  async function saveVideoProgress(pct: number, completed: boolean) {
    await supabase.from('lesson_progress').upsert({
      profile_id: profileId, course_key: courseId, lesson_key: lessonId,
      type: 'video', watch_pct: pct, completed, updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,course_key,lesson_key' })
  }

  function toggleSimulated() {
    if (playing) {
      setPauses(p => p + 1)
      saveVideoProgress(progress, progress >= 90)
    }
    setPlaying(p => !p)
  }

  async function handleBack() {
    if (hasRealVideo && videoRef.current) videoRef.current.pause()
    else if (playing) setPlaying(false)
    await saveVideoProgress(progressRef.current, progressRef.current >= 90)
    onBack()
  }

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = videoRef.current
    if (!el || !el.duration) return
    const pct = Number(e.target.value)
    el.currentTime = (pct / 100) * el.duration
    setProgress(pct)
  }

  return (
    <div className="screen-container">
      <div className="back-nav">
        <button className="btn btn-sm btn-outline" onClick={handleBack}>← Back to Course</button>
      </div>
      <div className="video-player-wrap">
        {hasRealVideo ? (
          <div className="video-screen real-video">
            <video
              ref={videoRef}
              src={videoUrl}
              className="real-video-el"
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoadedMetadata}
              onPlay={onPlay}
              onPause={onPause}
              onEnded={onEnded}
              playsInline
              preload="metadata"
            />
            {progress >= 90 && <div className="video-complete-badge">✅ Watch requirement met</div>}
          </div>
        ) : (
          <div className="video-screen">
            <div className="video-placeholder">
              <div className="video-placeholder-icon">🎬</div>
              <div className="video-placeholder-title">{lesson?.title ?? course.title}</div>
              <div className="video-placeholder-sub">No video uploaded yet</div>
            </div>
            <div className={`video-overlay${playing ? ' playing' : ''}`}>
              <button className="video-play-btn" onClick={toggleSimulated}>{playing ? '⏸' : '▶'}</button>
            </div>
            {progress >= 90 && <div className="video-complete-badge">✅ Watch requirement met</div>}
          </div>
        )}

        <div className="video-controls">
          <div className="video-progress-bar" style={{ cursor: hasRealVideo ? 'pointer' : 'default' }}>
            {hasRealVideo ? (
              <input type="range" className="video-seek-slider" min={0} max={100} value={progress} onChange={handleSeek} />
            ) : (
              <div className="video-progress-fill" style={{ width: `${progress}%` }} />
            )}
          </div>
          <div className="video-controls-row">
            {hasRealVideo ? (
              <>
                <button className="btn btn-sm" onClick={() => playing ? videoRef.current?.pause() : videoRef.current?.play()}>
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <span className="video-time">{currentTime} / {totalTime}</span>
                <button className="btn btn-sm btn-outline" onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.pause() } }}>
                  ⏮ Restart
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-sm" onClick={toggleSimulated}>{playing ? '⏸ Pause' : '▶ Play'}</button>
                <span className="video-time">{Math.floor(progress * 0.12 * 60)}s / 12:00</span>
                <button className="btn btn-sm btn-outline" onClick={() => { setProgress(0); setPlaying(false) }}>⏮ Restart</button>
              </>
            )}
          </div>
        </div>

        <div className="video-stats">
          <div className="video-stat"><span>Progress</span><strong>{progress}%</strong></div>
          <div className="video-stat"><span>Pauses</span><strong>{pauses}</strong></div>
          <div className="video-stat">
            <span>Status</span>
            <strong style={{ color: progress >= 90 ? 'var(--green)' : 'var(--amber)' }}>
              {progress >= 90 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started'}
            </strong>
          </div>
          {!hasRealVideo && (
            <div className="video-stat video-stat-note">
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>Upload a video in the Syllabus Builder to replace this placeholder</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── DocViewer ───────────────────────────────────────────────────────────────

function DocViewer({
  lesson, resolvedUrl, courseId, lessonId, profileId, initialPage, initialAcked, onBack, onCompleted,
}: {
  lesson?: Lesson
  resolvedUrl?: string
  courseId: string
  lessonId: string
  profileId: string
  initialPage: number
  initialAcked: boolean
  onBack: () => void
  onCompleted: () => void
}) {
  const [page, setPage] = useState(initialPage)
  const [acked, setAcked] = useState(initialAcked)

  // resolvedUrl takes priority over lesson-level doc_url
  const docUrl = resolvedUrl ?? lesson?.doc_url
  const totalPages = docUrl ? 1 : 6

  const pageContent = [
    { title: 'Introduction', body: 'This policy establishes the standard procedures for infection control and prevention in all clinical areas. All staff members are required to follow these guidelines to ensure patient and staff safety.' },
    { title: 'Hand Hygiene Requirements', body: 'Hand hygiene must be performed: before and after patient contact, before invasive procedures, after exposure to body fluids, after contact with patient surroundings.' },
    { title: 'Personal Protective Equipment', body: 'Appropriate PPE must be selected based on the anticipated exposure. Gloves, gowns, masks, and eye protection are available in all clinical areas.' },
    { title: 'Isolation Precautions', body: 'Standard precautions apply to all patients. Transmission-based precautions (contact, droplet, airborne) are implemented based on the suspected or confirmed infectious agent.' },
    { title: 'Environmental Cleaning', body: 'Patient care areas must be cleaned and disinfected regularly. High-touch surfaces require more frequent cleaning. Terminal cleaning is performed after patient discharge.' },
    { title: 'Reporting Requirements', body: 'All healthcare-associated infections must be reported to the Infection Control department within 24 hours. Complete the incident report form and notify the charge nurse.' },
  ]

  async function saveDocProgress(currentPage: number, acknowledged: boolean, completed: boolean) {
    await supabase.from('lesson_progress').upsert({
      profile_id: profileId, course_key: courseId, lesson_key: lessonId,
      type: 'doc', doc_page: currentPage, doc_total_pages: totalPages,
      doc_acked: acknowledged, completed, updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,course_key,lesson_key' })
  }

  function goToPage(newPage: number) {
    setPage(newPage)
    saveDocProgress(newPage, acked, acked)
  }

  async function handleAcknowledge() {
    setAcked(true)
    await saveDocProgress(page, true, true)
    onCompleted()
  }

  return (
    <div className="screen-container">
      <div className="back-nav">
        <button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button>
      </div>
      <div className="doc-viewer-wrap">
        <div className="doc-viewer-header">
          <h3>{lesson?.title ?? 'Document'}</h3>
          {!docUrl && (
            <div className="doc-page-nav">
              <button className="btn btn-sm" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1}>‹ Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn btn-sm" onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Next ›</button>
            </div>
          )}
        </div>

        {docUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <iframe
              src={docUrl}
              style={{ width: '100%', height: 520, border: '1px solid var(--border)', borderRadius: 8 }}
              title={lesson?.title}
            />
            {lesson?.doc_filename && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                📄 {lesson.doc_filename} ·{' '}
                <a href={docUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--teal)' }}>Open in new tab</a>
              </div>
            )}
          </div>
        ) : (
          <div className="doc-page">
            <h2 className="doc-page-title">{pageContent[page - 1].title}</h2>
            <p className="doc-page-body">{pageContent[page - 1].body}</p>
            {page === 1 && (
              <div className="doc-meta">
                <span><strong>Document No:</strong> IC-P-04</span>
                <span><strong>Version:</strong> 3.2</span>
                <span><strong>Last Updated:</strong> 2025-01-01</span>
                <span><strong>Department:</strong> Infection Control</span>
              </div>
            )}
          </div>
        )}

        <div className="doc-progress-bar-wrap">
          <div className="bar-track">
            <div className="bar-fill" style={{ width: docUrl ? '100%' : `${(page / totalPages) * 100}%` }} />
          </div>
          <span>{docUrl ? '100' : Math.round((page / totalPages) * 100)}% read</span>
        </div>

        {(docUrl || page === totalPages) && !acked && (
          <div className="doc-ack-box">
            <p>I have read and understood this document and will comply with all requirements.</p>
            <button className="btn btn-primary" onClick={handleAcknowledge}>✅ Acknowledge</button>
          </div>
        )}

        {acked && (
          <div className="doc-acked">✅ Document acknowledged on {new Date().toLocaleDateString()}</div>
        )}
      </div>
    </div>
  )
}

// ─── QuizPlayer ──────────────────────────────────────────────────────────────

function QuizPlayer({
  course, courseId, lessonId, profileId, initialScore, onBack, onCompleted,
}: {
  course: Course
  courseId: string
  lessonId: string
  profileId: string
  initialScore: number | null
  onBack: () => void
  onCompleted: () => void
}) {
  const [phase, setPhase] = useState<'start' | 'quiz' | 'result'>('start')
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(900)
  const [resultPct, setResultPct] = useState<number>(initialScore ?? 0)
  const [resultPassed, setResultPassed] = useState(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  const questions = [
    { q: 'What is the minimum hand hygiene duration recommended by WHO?', opts: ['10 seconds', '20–30 seconds', '45 seconds', '60 seconds'], correct: 1 },
    { q: 'Which PPE is required for airborne precautions?', opts: ['Surgical mask', 'N95 respirator', 'Gloves only', 'Gown and gloves'], correct: 1 },
    { q: 'When should gloves be changed between patients?', opts: ['Only if visibly soiled', 'After every patient', 'After two patients', 'When requested by supervisor'], correct: 1 },
    { q: 'Isolation precautions should be based on:', opts: ['Patient age', 'Type of suspected or confirmed infection', 'Doctor preference', 'Bed availability'], correct: 1 },
    { q: 'True or False: Hand sanitizer is effective against C. difficile spores.', opts: ['True', 'False', 'Sometimes', 'Depends on concentration'], correct: 1 },
  ]

  useEffect(() => {
    if (phase !== 'quiz') return
    const t = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { clearInterval(t); submitQuiz(answersRef.current); return 0 }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  async function submitQuiz(finalAnswers: Record<number, number>) {
    const correct = questions.filter((q, i) => finalAnswers[i] === q.correct).length
    const pct = Math.round((correct / questions.length) * 100)
    const passed = pct >= 80
    const bestScore = Math.max(pct, initialScore ?? 0)
    const bestPassed = passed || (initialScore != null && initialScore >= 80)

    await supabase.from('lesson_progress').upsert({
      profile_id: profileId, course_key: courseId, lesson_key: lessonId,
      type: 'quiz', quiz_score: bestScore, quiz_passed: bestPassed,
      completed: bestPassed, updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,course_key,lesson_key' })

    setResultPct(pct)
    setResultPassed(passed)
    if (passed) onCompleted()
    setPhase('result')
  }

  if (phase === 'start') {
    const alreadyPassed = initialScore != null && initialScore >= 80
    return (
      <div className="screen-container">
        <div className="back-nav"><button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button></div>
        <div className="quiz-start-card">
          <div className="quiz-start-icon">📝</div>
          <h2>Knowledge Check Quiz</h2>
          <p>{course.title}</p>
          {initialScore != null && (
            <div className="quiz-prev-score">
              Previous best: <strong style={{ color: alreadyPassed ? 'var(--green)' : 'var(--red)' }}>{initialScore}%</strong> {alreadyPassed ? '✅ Passed' : '❌ Not passed'}
            </div>
          )}
          <div className="quiz-start-info">
            <div className="quiz-info-item"><span>Questions</span><strong>{questions.length}</strong></div>
            <div className="quiz-info-item"><span>Time Limit</span><strong>15 min</strong></div>
            <div className="quiz-info-item"><span>Pass Score</span><strong>80%</strong></div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setPhase('quiz')}>
            {alreadyPassed ? 'Retake Quiz' : 'Start Quiz'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const correct = questions.filter((q, i) => answers[i] === q.correct).length
    return (
      <div className="screen-container">
        <div className="back-nav"><button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button></div>
        <div className="quiz-result-card">
          <div className={`quiz-result-icon ${resultPassed ? 'pass' : 'fail'}`}>{resultPassed ? '🎉' : '😔'}</div>
          <h2>{resultPassed ? 'Quiz Passed!' : 'Quiz Failed'}</h2>
          <div className="quiz-result-score">{resultPct}%</div>
          <p>{correct} out of {questions.length} correct</p>
          {resultPassed
            ? <p className="quiz-pass-msg">Congratulations! You have passed this quiz.</p>
            : <p className="quiz-fail-msg">You need 80% to pass. Please review and try again.</p>}
          <div className="quiz-result-review">
            {questions.map((q, i) => (
              <div key={i} className={`quiz-review-item ${answers[i] === q.correct ? 'correct' : 'incorrect'}`}>
                <span>{answers[i] === q.correct ? '✅' : '❌'} Q{i + 1}:</span> {q.q}
                <div className="quiz-review-answer">Your answer: <em>{q.opts[answers[i]] ?? 'Not answered'}</em></div>
                {answers[i] !== q.correct && <div className="quiz-review-correct">Correct: <em>{q.opts[q.correct]}</em></div>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-outline" onClick={() => { setPhase('start'); setAnswers({}); setQIdx(0); setTimeLeft(900) }}>Retry</button>
            <button className="btn btn-primary" onClick={onBack}>Back to Course</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[qIdx]
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60

  return (
    <div className="screen-container">
      <div className="quiz-player">
        <div className="quiz-player-header">
          <span>Question {qIdx + 1} of {questions.length}</span>
          <span className={`quiz-timer ${timeLeft < 60 ? 'urgent' : ''}`}>⏱ {mins}:{String(secs).padStart(2, '0')}</span>
        </div>
        <div className="quiz-progress-bar">
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(qIdx / questions.length) * 100}%` }} /></div>
        </div>
        <div className="quiz-question-card">
          <p className="quiz-question-text">{q.q}</p>
          <div className="quiz-options">
            {q.opts.map((opt, oi) => (
              <button key={oi} className={`quiz-option${answers[qIdx] === oi ? ' selected' : ''}`} onClick={() => setAnswers(a => ({ ...a, [qIdx]: oi }))}>
                <span className="option-letter">{String.fromCharCode(65 + oi)}</span> {opt}
              </button>
            ))}
          </div>
          <div className="quiz-nav-row">
            <button className="btn btn-outline" onClick={() => setQIdx(q => Math.max(0, q - 1))} disabled={qIdx === 0}>‹ Previous</button>
            {qIdx < questions.length - 1
              ? <button className="btn btn-primary" onClick={() => setQIdx(q => q + 1)} disabled={answers[qIdx] === undefined}>Next ›</button>
              : <button className="btn btn-primary" onClick={() => submitQuiz(answers)}>Submit Quiz</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
