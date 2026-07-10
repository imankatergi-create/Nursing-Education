import { useState, useEffect, useRef } from 'react'
import * as mammoth from 'mammoth'
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
  const [hasFeedback, setHasFeedback] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [courseLocked, setCourseLocked] = useState(false)
  const [lockRecord, setLockRecord] = useState<{ id: string; reason: string; locked_at: string } | null>(null)

  useEffect(() => {
    loadCourseData()
  }, [courseId])

  useEffect(() => {
    if (allLessonIds.length > 0) loadProgress()
  }, [courseId, profileId, allLessonIds.length])

  useEffect(() => {
    loadCourseLock()
  }, [courseId, profileId])

  useEffect(() => {
    supabase.from('feedback')
      .select('id')
      .eq('profile_id', profileId)
      .eq('course_id', courseId)
      .maybeSingle()
      .then(({ data }) => setHasFeedback(!!data))
  }, [courseId, profileId])

  async function loadCourseLock() {
    const { data } = await supabase
      .from('course_locks')
      .select('id, reason, locked_at')
      .eq('profile_id', profileId)
      .eq('course_id', courseId)
      .eq('is_locked', true)
      .maybeSingle()
    setCourseLocked(!!data)
    setLockRecord(data ?? null)
  }

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
    if (ids.length === 0) setLoadingProgress(false)
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
    if (courseLocked) return 'locked'
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

  async function handleLessonCompleted() {
    await loadProgress()
    backToCourse()
    if (!hasFeedback) {
      setShowFeedbackModal(true)
    }
  }

  async function handleCourseLocked() {
    await loadCourseLock()
    backToCourse()
  }

  const totalLessons = allLessonIds.length
  const doneCount = allLessonIds.filter(id => progressMap[id]?.completed).length
  const coursePct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0
  const courseCompleted = totalLessons > 0 && doneCount === totalLessons

  if (params.view === 'video') return (
    <VideoPlayer
      course={course}
      courseId={courseId}
      lessonId={params.lessonId ?? ''}
      profileId={profileId}
      initialProgress={progressMap[params.lessonId ?? '']?.watch_pct ?? 0}
      onBack={backToCourse}
      onCompleted={handleLessonCompleted}
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
      onCompleted={handleLessonCompleted}
    />
  )
  if (params.view === 'quiz') return (
    <QuizPlayer
      course={course}
      courseId={courseId}
      lessonId={params.lessonId ?? ''}
      profileId={profileId}
      initialScore={progressMap[params.lessonId ?? '']?.quiz_score ?? null}
      courseCompleted={courseCompleted}
      courseLocked={courseLocked}
      onBack={backToCourse}
      onCompleted={handleLessonCompleted}
      onCourseLocked={handleCourseLocked}
    />
  )

  const typeIcon: Record<string, string> = { video: '🎬', doc: '📄', quiz: '❓', eval: '📝' }
  const statusIcon: Record<LessonStatus, string> = { done: '✅', inprog: '▶️', todo: '⭕', locked: '🔒' }
  const statusColor: Record<LessonStatus, string> = { done: 'badge-green', inprog: 'badge-blue', todo: 'badge-gray', locked: 'badge-gray' }

  return (
    <div className="screen-container">
      {showFeedbackModal && (
        <FeedbackModal
          courseId={courseId}
          courseName={course?.title ?? ''}
          profileId={profileId}
          onClose={() => setShowFeedbackModal(false)}
          onSubmitted={() => { setHasFeedback(true); setShowFeedbackModal(false) }}
        />
      )}

      {courseLocked && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
          padding: '14px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: 14 }}>Course Locked</div>
            <div style={{ color: '#dc2626', fontSize: 13 }}>
              {lockRecord?.reason ?? 'This course has been locked due to exceeding quiz attempts.'} Contact your supervisor or educator to unlock.
            </div>
          </div>
        </div>
      )}

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

// ─── FeedbackModal ───────────────────────────────────────────────────────────

function FeedbackModal({
  courseId, courseName, profileId, onClose, onSubmitted,
}: {
  courseId: string
  courseName: string
  profileId: string
  onClose: () => void
  onSubmitted: () => void
}) {
  const [courseRating, setCourseRating] = useState(0)
  const [instructorRating, setInstructorRating] = useState(0)
  const [materialsRating, setMaterialsRating] = useState(0)
  const [relevanceRating, setRelevanceRating] = useState(0)
  const [difficulty, setDifficulty] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!courseRating) return
    setSubmitting(true)
    await supabase.from('feedback').insert({
      course_id: courseId,
      course_name: courseName,
      profile_id: profileId,
      course_rating: courseRating,
      instructor_rating: instructorRating || courseRating,
      materials_rating: materialsRating || courseRating,
      relevance_rating: relevanceRating || courseRating,
      difficulty: difficulty || 'Just Right',
      suggestions,
      anonymous: false,
      submitted_at: new Date().toISOString(),
    })
    setSubmitting(false)
    onSubmitted()
  }

  function StarPicker({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    const [hover, setHover] = useState(0)
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,2,3,4,5].map(i => (
            <span
              key={i}
              style={{ fontSize: 28, cursor: 'pointer', color: i <= (hover || value) ? '#f59e0b' : 'var(--border)', transition: 'color 0.1s' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => onChange(i)}
            >★</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32,
        maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>How was the lesson?</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{courseName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1, padding: '0 0 0 12px' }}>×</button>
        </div>

        <StarPicker label="Overall course rating *" value={courseRating} onChange={setCourseRating} />
        <StarPicker label="Instructor effectiveness" value={instructorRating} onChange={setInstructorRating} />
        <StarPicker label="Quality of materials" value={materialsRating} onChange={setMaterialsRating} />
        <StarPicker label="Relevance to your role" value={relevanceRating} onChange={setRelevanceRating} />

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Difficulty level</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Too Easy', 'Just Right', 'Too Hard'].map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`btn btn-sm${difficulty === d ? ' btn-primary' : ' btn-outline'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Suggestions or comments <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={suggestions}
            onChange={e => setSuggestions(e.target.value)}
            placeholder="What could be improved? What did you find useful?"
            rows={3}
            style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Skip for now</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!courseRating || submitting}
            style={{ opacity: !courseRating || submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Submitting…' : 'Submit Feedback'}
          </button>
        </div>
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
  // Blob URL for doc/pdf viewer — bypasses Content-Disposition: attachment from storage
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [docHtml, setDocHtml] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const prevBlobRef = useRef<string | null>(null)

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

  // When the active material changes, build the right viewer URL
  useEffect(() => {
    const mat = materials[activeIdx]
    if (!mat?.file_url) { setBlobUrl(null); setDocHtml(null); return }

    const rawUrl = mat.file_url
    const ext = rawUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
    const dbType = mat.type.toLowerCase()

    const isNative = ['image','audio','video'].includes(dbType) ||
      ['png','jpg','jpeg','gif','webp','svg','mp3','wav','ogg','m4a','mp4','webm','mov'].includes(ext)

    if (isNative) {
      setBlobUrl(rawUrl)
      setDocHtml(null)
      return
    }

    // Word documents → mammoth.js converts to HTML client-side, no external service needed
    const wordExts = ['doc','docx','odt']
    if (wordExts.includes(ext)) {
      setFetching(true)
      setFetchError('')
      setBlobUrl(null)
      setDocHtml(null)

      fetch(rawUrl)
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const buf = await r.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer: buf })
          setDocHtml(result.value)
        })
        .catch(err => setFetchError(`Could not load document: ${err.message}`))
        .finally(() => setFetching(false))
      return
    }

    // PDFs → fetch as blob with forced application/pdf MIME type so Chrome renders inline
    if (ext === 'pdf' || dbType === 'pdf') {
      setFetching(true)
      setFetchError('')
      setBlobUrl(null)
      setDocHtml(null)

      fetch(rawUrl)
        .then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const buf = await r.arrayBuffer()
          const blob = new Blob([buf], { type: 'application/pdf' })
          if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current)
          const url = URL.createObjectURL(blob)
          prevBlobRef.current = url
          setBlobUrl(url)
        })
        .catch(err => setFetchError(`Could not load document: ${err.message}`))
        .finally(() => setFetching(false))

      return () => {
        if (prevBlobRef.current) {
          URL.revokeObjectURL(prevBlobRef.current)
          prevBlobRef.current = null
        }
      }
    }

    // Other file types (pptx, xlsx, etc.) — show download fallback
    setBlobUrl(rawUrl)
    setDocHtml(null)
  }, [activeIdx, materials])

  // Reading timer
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
    if (!mat) return null

    if (fetchError) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ color: 'var(--red)', marginBottom: 12, fontSize: 14 }}>{fetchError}</div>
          {mat.file_url && (
            <a href={mat.file_url} target="_blank" rel="noreferrer" className="btn btn-primary">
              Download file
            </a>
          )}
        </div>
      )
    }

    if (fetching) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>Loading document…</span>
        </div>
      )
    }

    // Word doc converted to HTML by mammoth
    if (docHtml !== null) {
      return (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
          padding: '32px 40px', maxHeight: 700, overflowY: 'auto',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 15, lineHeight: 1.75, color: '#1a1a1a',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}
          dangerouslySetInnerHTML={{ __html: docHtml || '<p style="color:var(--muted)">Document is empty.</p>' }}
        />
      )
    }

    if (!blobUrl) return null

    const ext = (mat.file_url ?? '').split('?')[0].split('.').pop()?.toLowerCase() ?? ''
    const dbType = mat.type.toLowerCase()

    if (dbType === 'image' || ['png','jpg','jpeg','gif','webp','svg'].includes(ext)) {
      return <img src={blobUrl} alt={mat.title} style={{ maxWidth: '100%', borderRadius: 8, display: 'block', margin: '0 auto', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }} />
    }
    if (dbType === 'audio' || ['mp3','wav','ogg','m4a'].includes(ext)) {
      return <audio controls src={blobUrl} style={{ width: '100%' }} />
    }
    if (dbType === 'video' || ['mp4','webm','mov'].includes(ext)) {
      return <video controls src={blobUrl} style={{ width: '100%', borderRadius: 8 }} />
    }

    // PDF blob URL
    if (ext === 'pdf' || blobUrl.startsWith('blob:')) {
      return (
        <iframe
          key={blobUrl}
          src={blobUrl}
          title={mat.title}
          style={{ width: '100%', height: 700, border: 'none', borderRadius: 8, display: 'block', background: '#fff' }}
          allowFullScreen
        />
      )
    }

    // Unsupported format (pptx, xlsx, etc.) — show download prompt
    return (
      <div style={{ padding: '40px 32px', textAlign: 'center', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📎</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{mat.title}</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
          This file type ({ext.toUpperCase()}) must be downloaded to view.
        </div>
        <a href={blobUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
          Download to view
        </a>
      </div>
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
            {mat && renderViewer()}
          </>
        )}
      </div>

      {/* ── Sticky acknowledgement bar ── */}
      {materials.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: acked ? '#f0fdf4' : '#fff',
          borderTop: `2px solid ${acked ? 'var(--green)' : readyToAck ? 'var(--teal)' : 'var(--border)'}`,
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
          zIndex: 100,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
          flexWrap: 'wrap',
        }}>
          {!acked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 180 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {secondsRead}s read
              </span>
              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${readPct}%`,
                  background: readyToAck ? 'var(--green)' : 'var(--teal)',
                  borderRadius: 4, transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: 12, color: readyToAck ? 'var(--green)' : 'var(--muted)', fontWeight: readyToAck ? 700 : 400, whiteSpace: 'nowrap' }}>
                {readyToAck ? '✓ Ready' : `${MIN_READ_SECONDS - secondsRead}s left`}
              </span>
            </div>
          )}
          {acked ? (
            <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>
              ✅ Acknowledged on {new Date().toLocaleDateString()}
            </span>
          ) : (
            <>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>
                I have read and understood this document.
              </span>
              <button
                className="btn btn-primary"
                onClick={handleAcknowledge}
                style={{ flexShrink: 0, opacity: readyToAck ? 1 : 0.55 }}
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

interface QuizConfig {
  id: string
  title: string
  pass_score: number
  time_limit_min: number
  max_attempts: number
}

interface QQuestion {
  id: string
  question: string
  type: string
  options: string[]
  correct_answer: number
  explanation: string
  points: number
}

interface QAttempt {
  id: string
  score_pct: number
  passed: boolean
  answers: number[]
  attempted_at: string
}

function QuizPlayer({
  course, courseId, lessonId, profileId, initialScore,
  courseCompleted, courseLocked,
  onBack, onCompleted, onCourseLocked,
}: {
  course: Course | null
  courseId: string
  lessonId: string
  profileId: string
  initialScore: number | null
  courseCompleted: boolean
  courseLocked: boolean
  onBack: () => void
  onCompleted: () => void
  onCourseLocked: () => void
}) {
  const [phase, setPhase] = useState<'loading' | 'no_quiz' | 'start' | 'quiz' | 'result' | 'locked_out'>('loading')
  const [quiz, setQuiz] = useState<QuizConfig | null>(null)
  const [questions, setQuestions] = useState<QQuestion[]>([])
  const [attempts, setAttempts] = useState<QAttempt[]>([])
  const [freshCount, setFreshCount] = useState(0)
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [resultPct, setResultPct] = useState(0)
  const [resultPassed, setResultPassed] = useState(false)
  const [lastAnswers, setLastAnswers] = useState<number[]>([])
  const answersRef = useRef(answers)
  answersRef.current = answers

  useEffect(() => { loadQuizData() }, [lessonId])

  async function loadQuizData() {
    const { data: lesson } = await supabase.from('lessons').select('quiz_id').eq('id', lessonId).maybeSingle()
    if (!lesson?.quiz_id) { setPhase('no_quiz'); return }

    const { data: quizData } = await supabase
      .from('quizzes')
      .select('id, title, pass_score, time_limit_min, max_attempts')
      .eq('id', lesson.quiz_id)
      .maybeSingle()
    if (!quizData) { setPhase('no_quiz'); return }
    setQuiz(quizData)
    setTimeLeft(quizData.time_limit_min * 60)

    const { data: qs } = await supabase
      .from('quiz_questions')
      .select('id, question, type, options, correct_answer, explanation, points, order_index')
      .eq('quiz_id', quizData.id)
      .order('order_index')
    const qList = (qs ?? []) as QQuestion[]
    setQuestions(qList)

    const { data: attemptsData } = await supabase
      .from('quiz_attempts')
      .select('id, score_pct, passed, answers, attempted_at')
      .eq('profile_id', profileId)
      .eq('lesson_id', lessonId)
      .order('attempted_at', { ascending: false })
    const allAttempts = (attemptsData ?? []) as QAttempt[]
    setAttempts(allAttempts)

    if (allAttempts.length > 0) {
      const last = allAttempts[0]
      setLastAnswers(Array.isArray(last.answers) ? last.answers : [])
    }

    if (courseLocked) { setPhase('locked_out'); return }

    const fc = await getFreshAttemptCount(quizData.id)
    setFreshCount(fc)
    if (fc >= quizData.max_attempts) { setPhase('locked_out'); return }

    setPhase('start')
  }

  async function getFreshAttemptCount(_quizId: string): Promise<number> {
    const { data: lockRow } = await supabase
      .from('course_locks')
      .select('unlocked_at, is_locked')
      .eq('profile_id', profileId)
      .eq('course_id', courseId)
      .maybeSingle()

    let q = supabase.from('quiz_attempts').select('id').eq('profile_id', profileId).eq('lesson_id', lessonId)
    if (lockRow?.unlocked_at && !lockRow.is_locked) q = q.gt('attempted_at', lockRow.unlocked_at)
    const { data } = await q
    return (data ?? []).length
  }

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
    if (!quiz || questions.length === 0) return

    let totalPoints = 0; let earnedPoints = 0
    for (let i = 0; i < questions.length; i++) {
      totalPoints += questions[i].points
      if (finalAnswers[i] === questions[i].correct_answer) earnedPoints += questions[i].points
    }
    const pct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    const passed = pct >= quiz.pass_score
    const answersArr = questions.map((_, i) => finalAnswers[i] ?? -1)
    setLastAnswers(answersArr)

    const now = new Date().toISOString()
    await supabase.from('quiz_attempts').insert({
      profile_id: profileId,
      course_id: courseId,
      lesson_id: lessonId,
      quiz_id: quiz.id,
      score_pct: pct,
      passed,
      answers: answersArr,
      attempt_number: attempts.length + 1,
      started_at: now,
      submitted_at: now,
      score: earnedPoints,
      total_points: totalPoints,
      percentage: pct,
    })

    const bestScore = Math.max(pct, initialScore ?? 0)
    const bestPassed = passed || (initialScore != null && initialScore >= quiz.pass_score)
    await supabase.from('lesson_progress').upsert({
      profile_id: profileId,
      course_key: courseId,
      lesson_key: lessonId,
      type: 'quiz',
      quiz_score: bestScore,
      quiz_passed: bestPassed,
      completed: bestPassed,
      updated_at: now,
    }, { onConflict: 'profile_id,course_key,lesson_key' })

    setResultPct(pct)
    setResultPassed(passed)

    if (passed) { onCompleted(); setPhase('result'); return }

    const fc = await getFreshAttemptCount(quiz.id)
    setFreshCount(fc)
    if (fc >= quiz.max_attempts) {
      await supabase.from('course_locks').upsert({
        profile_id: profileId,
        course_id: courseId,
        reason: `Exceeded maximum attempts (${quiz.max_attempts}) for "${quiz.title}"`,
        locked_at: now,
        locked_by: 'system',
        is_locked: true,
        unlocked_at: null,
        unlocked_by: null,
      }, { onConflict: 'profile_id,course_id' })
      setPhase('locked_out')
      onCourseLocked()
      return
    }

    setPhase('result')
  }

  if (phase === 'loading') return (
    <div className="screen-container">
      <div className="back-nav"><button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button></div>
      <div className="loading-state">Loading quiz…</div>
    </div>
  )

  if (phase === 'no_quiz') return (
    <div className="screen-container">
      <div className="back-nav"><button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button></div>
      <div className="quiz-start-card">
        <div className="quiz-start-icon">📝</div>
        <h2>No Quiz Available</h2>
        <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No quiz has been assigned to this lesson yet.</p>
        <button className="btn btn-outline" onClick={onBack}>Back to Course</button>
      </div>
    </div>
  )

  if (phase === 'locked_out') return (
    <div className="screen-container">
      <div className="back-nav"><button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button></div>
      <div className="quiz-result-card">
        <div className="quiz-result-icon fail">🔒</div>
        <h2>Course Locked</h2>
        <p style={{ color: 'var(--muted)', textAlign: 'center', maxWidth: 400 }}>
          You have used all {quiz?.max_attempts ?? 0} attempt{(quiz?.max_attempts ?? 0) !== 1 ? 's' : ''} without passing.
          This course has been locked. Please contact your supervisor or educator to unlock it.
        </p>
        {attempts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, width: '100%', maxWidth: 360 }}>
            {attempts.slice(0, 3).map((a, i) => (
              <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Attempt {attempts.length - i}</span>
                <span style={{ fontWeight: 700, color: a.passed ? 'var(--green)' : 'var(--red)' }}>{a.score_pct}%</span>
                <span style={{ color: 'var(--muted)' }}>{new Date(a.attempted_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-outline" onClick={onBack} style={{ marginTop: 16 }}>Back to Course</button>
      </div>
    </div>
  )

  if (phase === 'start') {
    const alreadyPassed = initialScore != null && quiz != null && initialScore >= quiz.pass_score
    const attemptsLeft = quiz ? quiz.max_attempts - freshCount : 0
    const isReviewMode = courseCompleted

    return (
      <div className="screen-container">
        <div className="back-nav"><button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button></div>
        <div className="quiz-start-card">
          <div className="quiz-start-icon">📝</div>
          <h2>{isReviewMode ? 'Quiz Review' : (quiz?.title ?? 'Knowledge Check')}</h2>
          <p>{course?.title}</p>
          {initialScore != null && (
            <div className="quiz-prev-score">
              Best score: <strong style={{ color: alreadyPassed ? 'var(--green)' : 'var(--red)' }}>
                {initialScore}%
              </strong> {alreadyPassed ? '✅ Passed' : '❌ Not passed'}
            </div>
          )}
          {quiz && (
            <div className="quiz-start-info">
              <div className="quiz-info-item"><span>Questions</span><strong>{questions.length}</strong></div>
              <div className="quiz-info-item"><span>Time Limit</span><strong>{quiz.time_limit_min} min</strong></div>
              <div className="quiz-info-item"><span>Pass Score</span><strong>{quiz.pass_score}%</strong></div>
              {!isReviewMode && (
                <div className="quiz-info-item">
                  <span>Attempts Left</span>
                  <strong style={{ color: attemptsLeft <= 1 ? 'var(--red)' : 'var(--text)' }}>{attemptsLeft}</strong>
                </div>
              )}
            </div>
          )}

          {isReviewMode && lastAnswers.length > 0 ? (
            <>
              <div className="quiz-result-review" style={{ textAlign: 'left', width: '100%', marginTop: 16 }}>
                {questions.map((q, i) => {
                  const chosen = lastAnswers[i] ?? -1
                  const correct = chosen === q.correct_answer
                  return (
                    <div key={q.id} className={`quiz-review-item ${correct ? 'correct' : 'incorrect'}`}>
                      <span>{correct ? '✅' : '❌'} Q{i + 1}:</span> {q.question}
                      <div className="quiz-review-answer">
                        Your answer: <em>{q.options[chosen] ?? 'Not answered'}</em>
                      </div>
                      {!correct && (
                        <div className="quiz-review-correct">Correct answer: <em>{q.options[q.correct_answer]}</em></div>
                      )}
                      {q.explanation && (
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <button className="btn btn-outline" onClick={onBack} style={{ marginTop: 8 }}>Back to Course</button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => { setAnswers({}); setQIdx(0); setTimeLeft((quiz?.time_limit_min ?? 15) * 60); setPhase('quiz') }}
              disabled={questions.length === 0}
            >
              {alreadyPassed ? 'Retake Quiz' : 'Start Quiz'}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const correct = questions.filter((q, i) => lastAnswers[i] === q.correct_answer).length
    const attemptsLeft = quiz ? quiz.max_attempts - freshCount : 0

    return (
      <div className="screen-container">
        <div className="back-nav"><button className="btn btn-sm btn-outline" onClick={onBack}>← Back to Course</button></div>
        <div className="quiz-result-card">
          <div className={`quiz-result-icon ${resultPassed ? 'pass' : 'fail'}`}>
            {resultPassed ? '🎉' : '😔'}
          </div>
          <h2>{resultPassed ? 'Quiz Passed!' : 'Quiz Failed'}</h2>
          <div className="quiz-result-score">{resultPct}%</div>
          <p>{correct} out of {questions.length} correct · Pass score: {quiz?.pass_score ?? 80}%</p>
          {resultPassed
            ? <p className="quiz-pass-msg">Congratulations! You have passed this quiz.</p>
            : (
              <p className="quiz-fail-msg">
                You need {quiz?.pass_score ?? 80}% to pass.
                {attemptsLeft > 0 ? ` You have ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.` : ' No attempts remaining.'}
              </p>
            )}
          <div className="quiz-result-review">
            {questions.map((q, i) => {
              const chosen = lastAnswers[i] ?? -1
              const correct = chosen === q.correct_answer
              return (
                <div key={q.id} className={`quiz-review-item ${correct ? 'correct' : 'incorrect'}`}>
                  <span>{correct ? '✅' : '❌'} Q{i + 1}:</span> {q.question}
                  <div className="quiz-review-answer">Your answer: <em>{q.options[chosen] ?? 'Not answered'}</em></div>
                  {!correct && <div className="quiz-review-correct">Correct: <em>{q.options[q.correct_answer]}</em></div>}
                  {q.explanation && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{q.explanation}</div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            {!resultPassed && attemptsLeft > 0 && (
              <button
                className="btn btn-outline"
                onClick={() => { setAnswers({}); setQIdx(0); setTimeLeft((quiz?.time_limit_min ?? 15) * 60); setPhase('quiz') }}
              >
                Try Again ({attemptsLeft} left)
              </button>
            )}
            <button className="btn btn-primary" onClick={onBack}>Back to Course</button>
          </div>
        </div>
      </div>
    )
  }

  // quiz phase
  const q = questions[qIdx]
  if (!q) return null
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
          <p className="quiz-question-text">{q.question}</p>
          <div className="quiz-options">
            {(q.options ?? []).map((opt, oi) => (
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
