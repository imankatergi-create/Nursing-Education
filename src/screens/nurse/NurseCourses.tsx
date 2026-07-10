import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { COURSES } from '../../data/constants'

const STATUSES = ['all', 'in-progress', 'not-started', 'completed', 'overdue']
const TOTAL_DEMO_LESSONS = 6

const FALLBACK_STATUSES = ['in-progress', 'not-started', 'completed', 'overdue', 'in-progress', 'not-started']
const FALLBACK_PCTS = [65, 0, 100, 20, 40, 0]

interface CourseProgress {
  done: number
  total: number
}

export default function NurseCourses() {
  const { navigate, profile } = useApp()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [courseProgressMap, setCourseProgressMap] = useState<Record<string, CourseProgress>>({})

  useEffect(() => {
    if (!profile?.id) return
    loadProgress()
  }, [profile?.id])

  async function loadProgress() {
    const { data } = await supabase
      .from('lesson_progress')
      .select('course_key, completed')
      .eq('profile_id', profile!.id)
    if (!data || data.length === 0) return

    const map: Record<string, CourseProgress> = {}
    for (const row of data) {
      if (!map[row.course_key]) map[row.course_key] = { done: 0, total: 0 }
      map[row.course_key].total++
      if (row.completed) map[row.course_key].done++
    }
    setCourseProgressMap(map)
  }

  function getCourseStatus(courseId: string, idx: number): string {
    const p = courseProgressMap[courseId]
    if (!p) return FALLBACK_STATUSES[idx % FALLBACK_STATUSES.length]
    const pct = Math.round((p.done / TOTAL_DEMO_LESSONS) * 100)
    if (pct >= 100) return 'completed'
    if (pct > 0) return 'in-progress'
    return 'not-started'
  }

  function getCoursePct(courseId: string, idx: number): number {
    const p = courseProgressMap[courseId]
    if (!p) return FALLBACK_PCTS[idx % FALLBACK_PCTS.length]
    return Math.round((p.done / TOTAL_DEMO_LESSONS) * 100)
  }

  const filtered = COURSES.filter((c, i) => {
    const st = getCourseStatus(c.id, i)
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
        <input
          className="search-input"
          placeholder="Search courses…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="tab-row">
        {STATUSES.map(s => {
          const count = s === 'all'
            ? COURSES.length
            : COURSES.filter((c, i) => getCourseStatus(c.id, i) === s).length
          return (
            <button
              key={s}
              className={`tab-btn${status === s ? ' active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'All' : s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              <span className="tab-count">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="nurse-courses-grid">
        {filtered.map((c, i) => {
          const courseIdx = COURSES.indexOf(c)
          const st = getCourseStatus(c.id, courseIdx)
          const pct = getCoursePct(c.id, courseIdx)
          return (
            <div
              key={c.id}
              className="nurse-course-card"
              onClick={() => navigate('ncourse', { courseId: c.id })}
            >
              <div
                className="nurse-course-thumb"
                style={{ background: thumbColors[i % thumbColors.length] }}
              >
                <span>{c.thumbnail_icon || '📚'}</span>
              </div>
              <div className="nurse-course-card-body">
                <div className="nurse-course-card-top">
                  <span className="course-code">{c.code}</span>
                  <span className={`badge ${statusColor[st] ?? 'badge-gray'}`}>
                    {st.replace('-', ' ')}
                  </span>
                </div>
                <h3 className="nurse-course-card-title">{c.title}</h3>
                <div className="nurse-course-card-meta">
                  <span>⏱ {c.duration}</span>
                  <span>📊 {c.level}</span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: st === 'overdue' ? 'var(--red)'
                          : st === 'completed' ? 'var(--green)'
                          : 'var(--teal)',
                      }}
                    />
                  </div>
                  <span className="progress-pct">{pct}%</span>
                </div>
                {c.mandatory && (
                  <span className="tag tag-red" style={{ marginTop: 6, display: 'inline-block' }}>
                    Mandatory
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>No courses match your filter.</div>
        )}
      </div>
    </div>
  )
}
