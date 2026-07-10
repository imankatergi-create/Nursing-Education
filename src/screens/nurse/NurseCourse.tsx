import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import type { Course, CourseModule, Lesson } from '../../types'

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

  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, Lesson[]>>({})
  const [allLessonIds, setAllLessonIds] = useState<string[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, LessonRow>>({})
  const [loadingProgress, setLoadingProgress] = useState(true)

  useEffect(() => {
    loadCourseData()
  }, [courseId])

  useEffect(() => {
    if (allLessonIds.length > 0) loadProgress()
  }, [courseId, profileId, allLessonIds.length])

  async function loadCourseData() {
    const { data: c } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle()
    setCourse(c ?? null)

    // Load modules via linked syllabuses; fall back to direct course_id for legacy data
    let modList: CourseModule[] = []
    const { data: linked } = await supabase
      .from('course_syllabuses')
      .select('syllabus_id')
      .eq('course_id', courseId)
    const syllabusIds = (linked ?? []).map((r: any) => r.syllabus_id as string).filter(Boolean)
    if (syllabusIds.length > 0) {
      const { data: mods } = await supabase
        .from('course_modules')
        .select('*')
        .in('syllabus_id', syllabusIds)
        .order('order_index')
      modList = mods ?? []
    } else {
      const { data: mods } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index')
      modList = mods ?? []
    }
    setModules(modList)
    const map: Record<string, Lesson[]> = {}
    const ids: string[] = []
    for (const mod of modList) {
      const { data: lsns } = await supabase.from('lessons').select('*').eq('module_id', mod.id).order('order_index')
      map[mod.id] = lsns ?? []
      for (const l of (lsns ?? [])) ids.push(l.id)
    }
    setLessonsByModule(map)
    setAllLessonIds(ids)
  }

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
      if (allDone) await maybeIssueCertificate()
    }
    setLoadingProgress(false)
  }

  async function maybeIssueCertificate() {
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('profile_id', profileId)
      .eq('course_id', courseId)
      .maybeSingle()
    if (existing) return

    const bestScore = await supabase
      .from('lesson_progress')
      .select('quiz_score')
      .eq('profile_id', profileId)
      .eq('course_key', courseId)
      .not('quiz_score', 'is', null)
    const scores = (bestScore.data ?? []).map(r => r.quiz_score as number)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100

    const certNo = `CERT-${Date.now().toString(36).toUpperCase()}`
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 2)

    await supabase.from('certificates').insert({
      cert_no: certNo,
      profile_id: profileId,
      course_id: courseId,
      course_name: course?.title ?? '',
      issued_at: new Date().toISOString(),
      score_pct: `${avgScore}%`,
      expiry_date: expiryDate.toISOString().split('T')[0],
      status: 'Valid',
      verify_code: Math.random().toString(36).substring(2, 10).toUpperCase(),
      issued_by: 'System',
    })

    await supabase.from('nurse_enrollments')
      .update({ status: 'completed', completion_pct: 100, last_activity: 'Completed' })
      .eq('profile_id', profileId)
      .eq('course_id', courseId)
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

  function openLesson(lesson: Lesson) {
    const st = getLessonStatus(lesson.id)
    if (st === 'locked') return
    const dest = lesson.type === 'video' ? 'video'
      : lesson.type === 'doc' ? 'doc'
      : 'quiz'
    navigate('ncourse', { ...params, view: dest, lessonId: lesson.id })
  }

  const backToCourse = () => navigate('ncourse', { courseId })

  if (params.view === 'video') return (
    <VideoPlayer
      course={course}
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

  const totalLessons = allLessonIds.length
  const doneCount = allLessonIds.filter(id => progressMap[id]?.completed).length
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
          <span className="course-code">{course?.code}</span>
          <h1 className="course-hero-title">{course?.title ?? 'Loading…'}</h1>
          <div className="course-hero-meta">
            <span>👨‍🏫 {course?.instructor}</span>
            <span>⏱ {course?.duration}</span>
            <span>📊 {course?.level}</span>
            <span>🌐 {course?.lang}</span>
          </div>
          <div className="course-hero-progress">
            <div className="bar-track" style={{ maxWidth: 300 }}>
              <div className="bar-fill" style={{ width: `${coursePct}%` }} />
            </div>
            <span>
              {loadingProgress
                ? 'Loading progress…'
                : `${coursePct}% complete (${doneCount}/${totalLessons} lessons)`}
            </span>
          </div>
        </div>
      </div>

      {course?.objectives && course.objectives.length > 0 && (
        <div className="course-objectives">
          <h3>Course Objectives</h3>
          <ul>{course.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </div>
      )}

      <div className="syllabus-modules">
        {modules.map(mod => (
          <div key={mod.id} className="module-block">
            <div className="module-header"><h3>{mod.title}</h3></div>
            <div className="lessons-list">
              {(lessonsByModule[mod.id] ?? []).map(lesson => {
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
                    <span className="lesson-type-icon">{typeIcon[lesson.type]}</span>
                    <div className="lesson-info">
                      <span className="lesson-title">{lesson.title}</span>
                      <span className="lesson-meta">{lesson.duration_text} · {lesson.requirement}</span>
                      {lesson.type === 'video' && (p?.watch_pct ?? 0) > 0 && !p?.completed && (
                        <span className="lesson-sub-progress">{p!.watch_pct}% watched</span>
                      )}
                      {lesson.type === 'doc' && (p?.doc_page ?? 1) > 1 && !p?.completed && (
                        <span className="lesson-sub-progress">
                          Page {p!.doc_page}/{p!.doc_total_pages} read
                        </span>
                      )}
                      {lesson.type === 'quiz' && p?.quiz_score != null && (
                        <span className="lesson-sub-progress">
                          Best score: {p.quiz_score}% {p.quiz_passed ? '✅' : '❌'}
                        </span>
                      )}
                      {locked && (
                        <span className="lesson-locked-note">Complete the previous lesson to unlock</span>
                      )}
                    </div>
                    <span className={`badge ${statusColor[st]}`}>{st}</span>
                    {!locked && <span className="lesson-arrow">›</span>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {modules.length === 0 && !loadingProgress && (
          <div className="empty-state">No syllabus content yet for this course.</div>
        )}
      </div>
    </div>
  )
}

// ─── VideoPlayer ────────────────────────────────────────────────────────────

function VideoPlayer({
  course, courseId, lessonId, profileId, initialProgress, onBack, onCompleted,
}: {
  course: Course | null
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

  const hasRealVideo = Boolean(course?.video_url)

  // ── Real video event handlers ──────────────────────────────────────────────
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
    // Seek to saved position
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

  // ── Simulated video (no real video uploaded) ───────────────────────────────
  useEffect(() => {
    if (hasRealVideo) return
    let interval: ReturnType<typeof setInterval>
    if (playing && progress < 100) {
      interval = setInterval(() => setProgress(p => Math.min(p + 1, 100)), 300)
    }
    return () => clearInterval(interval)
  }, [playing, progress, hasRealVideo])

  // Persist when completion threshold reached (simulated player only)
  useEffect(() => {
    if (hasRealVideo) return
    if (progress >= 90 && !alreadyCompleted.current) {
      alreadyCompleted.current = true
      saveVideoProgress(progress, true).then(onCompleted)
    }
  }, [progress, hasRealVideo])

  async function saveVideoProgress(pct: number, completed: boolean) {
    await supabase.from('lesson_progress').upsert({
      profile_id: profileId,
      course_key: courseId,
      lesson_key: lessonId,
      type: 'video',
      watch_pct: pct,
      completed,
      updated_at: new Date().toISOString(),
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
    if (hasRealVideo && videoRef.current) {
      videoRef.current.pause()
    } else if (playing) {
      setPlaying(false)
    }
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

        {/* ── Real HTML5 video ─────────────────────────────────────── */}
        {hasRealVideo ? (
          <div className="video-screen real-video">
            <video
              ref={videoRef}
              src={course?.video_url}
              className="real-video-el"
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoadedMetadata}
              onPlay={onPlay}
              onPause={onPause}
              onEnded={onEnded}
              playsInline
              preload="metadata"
            />
            {progress >= 90 && (
              <div className="video-complete-badge">✅ Watch requirement met</div>
            )}
          </div>
        ) : (
          /* ── Simulated placeholder ─────────────────────────────── */
          <div className="video-screen">
            <div className="video-placeholder">
              <div className="video-placeholder-icon">🎬</div>
              <div className="video-placeholder-title">{course?.title}</div>
              <div className="video-placeholder-sub">Introduction &amp; Overview</div>
            </div>
            <div className={`video-overlay${playing ? ' playing' : ''}`}>
              <button className="video-play-btn" onClick={toggleSimulated}>
                {playing ? '⏸' : '▶'}
              </button>
            </div>
            {progress >= 90 && (
              <div className="video-complete-badge">✅ Watch requirement met</div>
            )}
          </div>
        )}

        <div className="video-controls">
          <div className="video-progress-bar" style={{ cursor: hasRealVideo ? 'pointer' : 'default' }}>
            {hasRealVideo ? (
              <input
                type="range"
                className="video-seek-slider"
                min={0}
                max={100}
                value={progress}
                onChange={handleSeek}
              />
            ) : (
              <div className="video-progress-fill" style={{ width: `${progress}%` }} />
            )}
          </div>
          <div className="video-controls-row">
            {hasRealVideo ? (
              <>
                <button
                  className="btn btn-sm"
                  onClick={() => playing ? videoRef.current?.pause() : videoRef.current?.play()}
                >
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <span className="video-time">{currentTime} / {totalTime}</span>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => { if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.pause() } }}
                >
                  ⏮ Restart
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-sm" onClick={toggleSimulated}>{playing ? '⏸ Pause' : '▶ Play'}</button>
                <span className="video-time">{Math.floor(progress * 0.12 * 60)}s / 12:00</span>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => { setProgress(0); setPlaying(false) }}
                >
                  ⏮ Restart
                </button>
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
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>No video uploaded yet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── DocViewer ───────────────────────────────────────────────────────────────

interface LinkedMaterial {
  id: string
  title: string
  type: string
  file_url: string | null
  size_text: string
}

// Minimum seconds required before acknowledge unlocks (encourages reading)
const MIN_READ_SECONDS = 30

function DocViewer({
  courseId, lessonId, profileId, initialAcked, onBack, onCompleted,
}: {
  courseId: string
  lessonId: string
  profileId: string
  initialPage: number
  initialAcked: boolean
  onBack: () => void
  onCompleted: () => void
}) {
  const [materials, setMaterials] = useState<LinkedMaterial[]>([])
  const [lessonTitle, setLessonTitle] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [acked, setAcked] = useState(initialAcked)
  const [loading, setLoading] = useState(true)
  const [secondsRead, setSecondsRead] = useState(0)

  useEffect(() => {
    async function load() {
      const [{ data: lesson }, { data: lm }] = await Promise.all([
        supabase.from('lessons').select('title').eq('id', lessonId).maybeSingle(),
        supabase
          .from('lesson_materials')
          .select('order_index, materials(id, title, type, file_url, size_text)')
          .eq('lesson_id', lessonId)
          .order('order_index'),
      ])
      setLessonTitle(lesson?.title ?? 'Document')
      setMaterials((lm ?? []).map((r: any) => r.materials).filter(Boolean))
      setLoading(false)
    }
    load()
  }, [lessonId])

  // Reading timer — counts up while user is on this view
  useEffect(() => {
    if (acked) return
    const t = setInterval(() => setSecondsRead(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [acked])

  async function saveProgress(acknowledged: boolean, completed: boolean) {
    await supabase.from('lesson_progress').upsert({
      profile_id: profileId,
      course_key: courseId,
      lesson_key: lessonId,
      type: 'doc',
      doc_page: 1,
      doc_total_pages: 1,
      doc_acked: acknowledged,
      completed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,course_key,lesson_key' })
  }

  async function handleAcknowledge() {
    setAcked(true)
    await saveProgress(true, true)
    onCompleted()
  }

  const mat = materials[activeIdx] ?? null
  const readPct = Math.min(100, Math.round((secondsRead / MIN_READ_SECONDS) * 100))
  const readyToAck = acked || readPct >= 100

  const typeIcon: Record<string, string> = {
    PDF: '📄', Video: '🎬', PPT: '📊', Checklist: '✅',
    Protocol: '📋', 'Link/URL': '🔗', Image: '🖼️', Audio: '🎵',
  }

  function renderViewer() {
    if (!mat?.file_url) return null
    const url = mat.file_url
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
    const type = mat.type.toLowerCase()

    if (type === 'image' || ['png','jpg','jpeg','gif','webp','svg'].includes(ext)) {
      return (
        <img src={url} alt={mat.title} style={{ maxWidth: '100%', borderRadius: 8, display: 'block', margin: '0 auto', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }} />
      )
    }
    if (type === 'audio' || ['mp3','wav','ogg','m4a'].includes(ext)) {
      return <audio controls src={url} style={{ width: '100%' }} />
    }
    if (type === 'video' || ['mp4','webm','mov'].includes(ext)) {
      return <video controls src={url} style={{ width: '100%', borderRadius: 8 }} />
    }

    // PDF, PPT, Word, Protocol, Checklist, any other doc → Google Docs Viewer
    const viewerUrl = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`
    return (
      <iframe
        key={viewerUrl}
        src={viewerUrl}
        title={mat.title}
        style={{ width: '100%', height: 660, border: 'none', borderRadius: 8, display: 'block', background: '#fff' }}
        allowFullScreen
      />
    )
  }

  if (loading) {
    return (
      <div className="screen-container">
        <div className="loading-state">Loading document…</div>
      </div>
    )
  }

  return (
    <div className="screen-container" style={{ paddingBottom: 100 }}>
      <div className="back-nav">
        <button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button>
      </div>
      <div className="doc-viewer-wrap">
        <div className="doc-viewer-header">
          <h3>{lessonTitle}</h3>
          {materials.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {materials.map((m, i) => (
                <button
                  key={m.id}
                  className={`btn btn-sm${activeIdx === i ? ' btn-primary' : ' btn-outline'}`}
                  onClick={() => setActiveIdx(i)}
                >
                  {typeIcon[m.type] ?? '📎'} {m.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {materials.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No document attached yet</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>
              An educator hasn't linked a material to this lesson.
            </div>
          </div>
        ) : (
          <>
            {/* Material info bar */}
            {mat && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>{typeIcon[mat.type] ?? '📎'}</span>
                <span style={{ fontWeight: 600 }}>{mat.title}</span>
                {mat.size_text && <span style={{ color: 'var(--muted)', fontSize: 13 }}>{mat.size_text}</span>}
                {mat.file_url && (
                  <a href={mat.file_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }}>
                    Download
                  </a>
                )}
              </div>
            )}

            {/* Document viewer */}
            {mat && renderViewer()}
          </>
        )}
      </div>

      {/* ── Sticky acknowledgement bar ── */}
      {materials.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: acked ? '#f0fdf4' : '#fff',
          borderTop: `2px solid ${acked ? 'var(--green)' : readyToAck ? 'var(--teal)' : 'var(--border)'}`,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          zIndex: 100,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
          flexWrap: 'wrap',
        }}>
          {/* Reading progress */}
          {!acked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                Reading: {secondsRead}s
              </span>
              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${readPct}%`,
                  background: readyToAck ? 'var(--green)' : 'var(--teal)',
                  borderRadius: 4,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: 12, color: readyToAck ? 'var(--green)' : 'var(--muted)', whiteSpace: 'nowrap', fontWeight: readyToAck ? 700 : 400 }}>
                {readyToAck ? 'Ready' : `${MIN_READ_SECONDS - secondsRead}s left`}
              </span>
            </div>
          )}

          {acked ? (
            <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>
              ✅ Document acknowledged on {new Date().toLocaleDateString()}
            </span>
          ) : (
            <>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>
                I have read and understood this document and will comply with all requirements.
              </span>
              <button
                className="btn btn-primary"
                onClick={handleAcknowledge}
                style={{ flexShrink: 0, opacity: readyToAck ? 1 : 0.5 }}
                title={readyToAck ? undefined : `Please read the document for ${MIN_READ_SECONDS - secondsRead} more seconds`}
              >
                Acknowledge &amp; Complete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── QuizPlayer ──────────────────────────────────────────────────────────────

function QuizPlayer({
  course, courseId, lessonId, profileId, initialScore, onBack, onCompleted,
}: {
  course: Course | null
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
        if (p <= 1) {
          clearInterval(t)
          submitQuiz(answersRef.current)
          return 0
        }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  async function submitQuiz(finalAnswers: Record<number, number>) {
    const correct = questions.filter((q, i) => finalAnswers[i] === q.correct).length
    const pct = Math.round((correct / questions.length) * 100)
    const passed = pct >= 80

    // Keep best score
    const bestScore = Math.max(pct, initialScore ?? 0)
    const bestPassed = passed || (initialScore != null && initialScore >= 80)

    await supabase.from('lesson_progress').upsert({
      profile_id: profileId,
      course_key: courseId,
      lesson_key: lessonId,
      type: 'quiz',
      quiz_score: bestScore,
      quiz_passed: bestPassed,
      completed: bestPassed,
      updated_at: new Date().toISOString(),
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
        <div className="back-nav">
          <button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button>
        </div>
        <div className="quiz-start-card">
          <div className="quiz-start-icon">📝</div>
          <h2>Knowledge Check Quiz</h2>
          <p>{course?.title}</p>
          {initialScore != null && (
            <div className="quiz-prev-score">
              Previous best: <strong style={{ color: alreadyPassed ? 'var(--green)' : 'var(--red)' }}>
                {initialScore}%
              </strong> {alreadyPassed ? '✅ Passed' : '❌ Not passed'}
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
        <div className="back-nav">
          <button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button>
        </div>
        <div className="quiz-result-card">
          <div className={`quiz-result-icon ${resultPassed ? 'pass' : 'fail'}`}>
            {resultPassed ? '🎉' : '😔'}
          </div>
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
                <div className="quiz-review-answer">
                  Your answer: <em>{q.opts[answers[i]] ?? 'Not answered'}</em>
                </div>
                {answers[i] !== q.correct && (
                  <div className="quiz-review-correct">Correct: <em>{q.opts[q.correct]}</em></div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button
              className="btn btn-outline"
              onClick={() => { setPhase('start'); setAnswers({}); setQIdx(0); setTimeLeft(900) }}
            >
              Retry
            </button>
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
          <span className={`quiz-timer ${timeLeft < 60 ? 'urgent' : ''}`}>
            ⏱ {mins}:{String(secs).padStart(2, '0')}
          </span>
        </div>
        <div className="quiz-progress-bar">
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(qIdx / questions.length) * 100}%` }} />
          </div>
        </div>
        <div className="quiz-question-card">
          <p className="quiz-question-text">{q.q}</p>
          <div className="quiz-options">
            {q.opts.map((opt, oi) => (
              <button
                key={oi}
                className={`quiz-option${answers[qIdx] === oi ? ' selected' : ''}`}
                onClick={() => setAnswers(a => ({ ...a, [qIdx]: oi }))}
              >
                <span className="option-letter">{String.fromCharCode(65 + oi)}</span> {opt}
              </button>
            ))}
          </div>
          <div className="quiz-nav-row">
            <button
              className="btn btn-outline"
              onClick={() => setQIdx(q => Math.max(0, q - 1))}
              disabled={qIdx === 0}
            >
              ‹ Previous
            </button>
            {qIdx < questions.length - 1
              ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setQIdx(q => q + 1)}
                  disabled={answers[qIdx] === undefined}
                >
                  Next ›
                </button>
              )
              : (
                <button
                  className="btn btn-primary"
                  onClick={() => submitQuiz(answers)}
                >
                  Submit Quiz
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
