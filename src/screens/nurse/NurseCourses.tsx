import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import type { Course } from '../../types'

const STATUSES = ['all', 'in-progress', 'not-started', 'completed', 'overdue']

interface CourseProgress { done: number }

export default function NurseCourses() {
  const { navigate, profile } = useApp()
  const [courses, setCourses] = useState<Course[]>([])
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [progressMap, setProgressMap] = useState<Record<string, CourseProgress>>({})
  const [lessonTotals, setLessonTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [profile?.id])

  async function loadAll() {
    setLoading(true)
    const [{ data: c }, { data: p }, { data: mods }, { data: lsns }] = await Promise.all([
      supabase.from('courses').select('*').order('title'),
      profile?.id
        ? supabase.from('lesson_progress').select('course_key, completed').eq('profile_id', profile.id)
        : Promise.resolve({ data: [] }),
      supabase.from('course_modules').select('id, course_id'),
      supabase.from('lessons').select('id, module_id'),
    ])

    setCourses(c ?? [])

    // Build course_id -> total lesson count from modules + lessons
    const modToCourse: Record<string, string> = {}
    for (const m of (mods ?? [])) modToCourse[m.id] = m.course_id
    const totals: Record<string, number> = {}
    for (const l of (lsns ?? [])) {
      const cid = modToCourse[l.module_id]
      if (cid) totals[cid] = (totals[cid] ?? 0) + 1
    }
    setLessonTotals(totals)

    // Build course_id -> {done} from lesson_progress
    const map: Record<string, CourseProgress> = {}
    for (const row of (p ?? [])) {
      if (!map[row.course_key]) map[row.course_key] = { done: 0 }
      if (row.completed) map[row.course_key].done++
    }
    setProgressMap(map)
    setLoading(false)
  }

  function getCourseStatus(courseId: string): string {
    const done = progressMap[courseId]?.done ?? 0
    const total = lessonTotals[courseId] ?? 0
    if (total === 0 || done === 0) return 'not-started'
    if (done >= total) return 'completed'
    return 'in-progress'
  }

  function getCoursePct(courseId: string): number {
    const done = progressMap[courseId]?.done ?? 0
    const total = lessonTotals[courseId] ?? 0
    if (total === 0) return 0
    return Math.round((done / total) * 100)
  }

  const filtered = courses.filter(c => {
    const st = getCourseStatus(c.id)
    const q = search.toLowerCase()
    return (!q || c.title.toLowerCase().includes(q)) && (status === 'all' || st === status)
  })

  const statusColor: Record<string, string> = {
    'completed': 'badge-green', 'in-progress': 'badge-blue',
    'not-started': 'badge-gray', 'overdue': 'badge-red',
  }
  const thumbColors = ['#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7']

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">My Courses</h1>
          <p className="screen-subtitle">Your training assignments</p>
        </div>
      </div>

      <div className="table-toolbar">
        <input className="search-input" placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="tab-row">
        {STATUSES.map(s => {
          const count = s === 'all' ? courses.length : courses.filter(c => getCourseStatus(c.id) === s).length
          return (
            <button key={s} className={`tab-btn${status === s ? ' active' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              <span className="tab-count">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="nurse-courses-grid">
        {loading ? (
          <div className="loading-state" style={{ gridColumn: '1/-1' }}>Loading…</div>
        ) : filtered.map((c, i) => {
          const st = getCourseStatus(c.id)
          const pct = getCoursePct(c.id)
          return (
            <div key={c.id} className="nurse-course-card" onClick={() => navigate('ncourse', { courseId: c.id })}>
              <div className="nurse-course-thumb" style={{ background: thumbColors[i % thumbColors.length] }}>
                <span>{c.thumbnail_icon || '📚'}</span>
              </div>
              <div className="nurse-course-card-body">
                <div className="nurse-course-card-top">
                  <span className="course-code">{c.code}</span>
                  <span className={`badge ${statusColor[st] ?? 'badge-gray'}`}>{st.replace('-', ' ')}</span>
                </div>
                <h3 className="nurse-course-card-title">{c.title}</h3>
                <div className="nurse-course-card-meta">
                  <span>⏱ {c.duration}</span>
                  <span>📊 {c.level}</span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="bar-track">
                    <div className="bar-fill" style={{
                      width: `${pct}%`,
                      background: st === 'overdue' ? 'var(--red)' : st === 'completed' ? 'var(--green)' : 'var(--teal)',
                    }} />
                  </div>
                  <span className="progress-pct">{pct}%</span>
                </div>
                {c.mandatory && <span className="tag tag-red" style={{ marginTop: 6, display: 'inline-block' }}>Mandatory</span>}
              </div>
            </div>
          )
        })}
        {!loading && filtered.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>No courses match your filter.</div>
        )}
      </div>
    </div>
  )
}
