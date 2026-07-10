import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Feedback } from '../types'

function avg(items: Feedback[], key: keyof Feedback): string {
  const vals = items.map(f => f[key] as number).filter(v => v != null && !isNaN(v))
  if (vals.length === 0) return '—'
  return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1)
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= Math.round(rating) ? '#f59e0b' : 'var(--border)', fontSize: 14 }}>★</span>
      ))}
    </div>
  )
}

export default function FeedbackScreen() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('feedback')
        .select('*')
        .order('submitted_at', { ascending: false })
      setFeedback(data ?? [])
      setLoading(false)
    })()
  }, [])

  const kpis = [
    { label: 'Avg Course Rating',      value: avg(feedback, 'course_rating') },
    { label: 'Avg Instructor Rating',  value: avg(feedback, 'instructor_rating') },
    { label: 'Avg Materials Rating',   value: avg(feedback, 'materials_rating') },
    { label: 'Avg Relevance Rating',   value: avg(feedback, 'relevance_rating') },
  ]

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Course Feedback</h1>
          <p className="screen-subtitle">
            {feedback.length} {feedback.length === 1 ? 'review' : 'reviews'}
            {feedback.length > 0 && ` · Avg course rating: ${avg(feedback, 'course_rating')}/5`}
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card kpi-teal">
            <div className="kpi-icon">⭐</div>
            <div className="kpi-body">
              <div className="kpi-value">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Course Rating</th>
                <th>Instructor</th>
                <th>Materials</th>
                <th>Relevance</th>
                <th>Difficulty</th>
                <th>Suggestions</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
              ) : feedback.length === 0 ? (
                <tr><td colSpan={8} className="table-empty">No feedback submitted yet</td></tr>
              ) : feedback.map(f => (
                <tr key={f.id}>
                  <td>
                    <div>{f.course_name}</div>
                    {f.anonymous && <div className="tiny">Anonymous</div>}
                  </td>
                  <td><Stars rating={f.course_rating} /></td>
                  <td><Stars rating={f.instructor_rating} /></td>
                  <td><Stars rating={f.materials_rating} /></td>
                  <td><Stars rating={f.relevance_rating} /></td>
                  <td>
                    <span className={`badge ${
                      f.difficulty === 'Too Hard' ? 'badge-red'
                      : f.difficulty === 'Just Right' ? 'badge-green'
                      : 'badge-gray'
                    }`}>{f.difficulty}</span>
                  </td>
                  <td className="suggestions-cell">{f.suggestions || '—'}</td>
                  <td className="tiny">{f.submitted_at ? new Date(f.submitted_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
