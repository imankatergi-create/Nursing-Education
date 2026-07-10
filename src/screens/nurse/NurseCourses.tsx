import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const STATUSES = ['all', 'in-progress', 'not-started', 'completed', 'overdue']

interface EnrolledCourse {
  enrollId: string
  courseId: string
  title: string
  code: string
  category: string
  duration: string
  level: string
  thumbnail_icon: string
  mandatory: boolean
  enrollStatus: string  // from nurse_enrollments
  completionPct: number // from lesson_progress calculation
  dueDate: string | null
  totalLessons: number
  doneLessons: number
}

const thumbColors = ['#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7']
const statusColor: Record<string, string> = {
  completed: 'badge-green', 'in-progress': 'badge-blue',
  'not-started': 'badge-gray', overdue: 'badge-red',
}

export default function NurseCourses() {
  const { navigate, profile } = useApp()
  const [courses, setCourses] = useState<EnrolledCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (profile?.id) loadCourses()
  }, [profile?.id])

  async function loadCourses() {
    setLoading(true)

    // Load nurse's enrollments with course details
    const { data: enrollments } = await supabase
      .from('nurse_enrollments')
      .select('id,course_id,status,completion_pct,due_date,mandatory,courses(id,title,code,category,duration,level,thumbnail_icon,thumbnail_color,mandatory)')
      .eq('profile_id', profile!.id)

    if (!enrollments || enrollments.length === 0) {
      setCourses([])
      setLoading(false)
      return
    }

    const courseIds = enrollments.map(e => e.course_id)

    // Count total lessons per course via course_modules → lessons
    const { data: lessonCounts } = await supabase
      .from('lessons')
      .select('module_id, course_modules!inner(course_id)')
      .in('course_modules.course_id', courseIds)

    const totalMap: Record<string, number> = {}
    for (const l of lessonCounts ?? []) {
      const courseId = (l.course_modules as unknown as { course_id: string }).course_id
      totalMap[courseId] = (totalMap[courseId] ?? 0) + 1
    }

    // Count completed lessons per course from lesson_progress
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('course_key,completed')
      .eq('profile_id', profile!.id)
      .in('course_key', courseIds)

    const doneMap: Record<string, number> = {}
    for (const p of progress ?? []) {
      if (p.completed) doneMap[p.course_key] = (doneMap[p.course_key] ?? 0) + 1
    }

    const list: EnrolledCourse[] = enrollments.map((e) => {
      const c = e.courses as unknown as { id: string; title: string; code: string; category: string; duration: string; level: string; thumbnail_icon: string; thumbnail_color: string; mandatory: boolean } | null
      const total = totalMap[e.course_id] ?? 0
      const done = doneMap[e.course_id] ?? 0
      const pct = total > 0 ? Math.round((done / total) * 100) : (e.completion_pct ?? 0)

      // Derive display status from actual progress
      let displayStatus = e.status ?? 'not_started'
      if (total > 0) {
        if (done >= total) displayStatus = 'completed'
        else if (done > 0) displayStatus = 'in-progress'
        else displayStatus = 'not-started'
      } else {
        // Fall back to enrollment status
        if (displayStatus === 'completed') displayStatus = 'completed'
        else if (displayStatus === 'in_progress') displayStatus = 'in-progress'
        else if (displayStatus === 'overdue') displayStatus = 'overdue'
        else displayStatus = 'not-started'
      }

      // Override with overdue if deadline passed and not completed
      if (e.due_date && new Date(e.due_date) < new Date() && displayStatus !== 'completed') {
        displayStatus = 'overdue'
      }

      return {
        enrollId: e.id,
        courseId: e.course_id,
        title: c?.title ?? 'Unknown Course',
        code: c?.code ?? '',
        category: c?.category ?? '',
        duration: c?.duration ?? '',
        level: c?.level ?? '',
        thumbnail_icon: c?.thumbnail_icon ?? '📚',
        mandatory: e.mandatory ?? c?.mandatory ?? false,
        enrollStatus: displayStatus,
        completionPct: pct,
        dueDate: e.due_date ?? null,
        totalLessons: total,
        doneLessons: done,
      }
    })

    setCourses(list)
    setLoading(false)
  }

  const filtered = courses.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    const matchStatus = status === 'all' || c.enrollStatus === status
    return matchSearch && matchStatus
  })

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = s === 'all' ? courses.length : courses.filter(c => c.enrollStatus === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">My Courses</h1>
          <p className="screen-subtitle">Your training assignments</p>
        </div>
      </div>

      <div className="table-toolbar">
        <input
          className="search-input"
          placeholder="Search courses…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="tab-row">
        {STATUSES.map(s => (
          <button
            key={s}
            className={`tab-btn${status === s ? ' active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s === 'all' ? 'All' : s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            <span className="tab-count">{statusCounts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">Loading courses…</div>
      ) : (
        <div className="nurse-courses-grid">
          {filtered.map((c, i) => (
            <div
              key={c.enrollId}
              className="nurse-course-card"
              onClick={() => navigate('ncourse', { courseId: c.courseId })}
            >
              <div className="nurse-course-thumb" style={{ background: thumbColors[i % thumbColors.length] }}>
                <span>{c.thumbnail_icon}</span>
              </div>
              <div className="nurse-course-card-body">
                <div className="nurse-course-card-top">
                  <span className="course-code">{c.code}</span>
                  <span className={`badge ${statusColor[c.enrollStatus] ?? 'badge-gray'}`}>
                    {c.enrollStatus.replace('-', ' ')}
                  </span>
                </div>
                <h3 className="nurse-course-card-title">{c.title}</h3>
                <div className="nurse-course-card-meta">
                  {c.duration && <span>⏱ {c.duration}</span>}
                  {c.level && <span>📊 {c.level}</span>}
                  {c.dueDate && <span>📅 Due {c.dueDate}</span>}
                </div>
                <div className="progress-bar-wrap">
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${c.completionPct}%`,
                        background: c.enrollStatus === 'overdue' ? 'var(--red)'
                          : c.enrollStatus === 'completed' ? 'var(--green)'
                          : 'var(--teal)',
                      }}
                    />
                  </div>
                  <span className="progress-pct">
                    {c.totalLessons > 0
                      ? `${c.doneLessons}/${c.totalLessons} lessons`
                      : `${c.completionPct}%`}
                  </span>
                </div>
                {c.mandatory && (
                  <span className="tag tag-red" style={{ marginTop: 6, display: 'inline-block' }}>Mandatory</span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              {courses.length === 0
                ? 'No courses assigned yet. Contact your supervisor to get enrolled.'
                : 'No courses match your filter.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
