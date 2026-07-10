import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FEEDBACK_DATA } from '../data/constants'
import type { Feedback } from '../types'

export default function FeedbackScreen() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabase.from('feedback').select('*').order('course_name')
      if (data && data.length > 0) setFeedback(data)
      else setFeedback(FEEDBACK_DATA)
      setLoading(false)
    })()
  }, [])

  const avgRating = feedback.length > 0
    ? (feedback.reduce((s, f) => s + f.course_rating, 0) / feedback.length).toFixed(1)
    : '0'

  function Stars({ rating }: { rating: number }) {
    return (
      <div className="stars">
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ color: i <= rating ? '#f59e0b' : 'var(--border)', fontSize: 14 }}>★</span>
        ))}
      </div>
    )
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Course Feedback</h1>
          <p className="screen-subtitle">{feedback.length} reviews · Avg rating: {avgRating}/5</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Avg Course Rating', value: feedback.length > 0 ? (feedback.reduce((s,f) => s+f.course_rating,0)/feedback.length).toFixed(1) : '—' },
          { label: 'Avg Instructor Rating', value: feedback.length > 0 ? (feedback.reduce((s,f) => s+f.instructor_rating,0)/feedback.length).toFixed(1) : '—' },
          { label: 'Avg Materials Rating', value: feedback.length > 0 ? (feedback.reduce((s,f) => s+f.materials_rating,0)/feedback.length).toFixed(1) : '—' },
          { label: 'Avg Relevance Rating', value: feedback.length > 0 ? (feedback.reduce((s,f) => s+f.relevance_rating,0)/feedback.length).toFixed(1) : '—' },
        ].map(k => (
          <div key={k.label} className="kpi-card kpi-teal">
            <div className="kpi-icon">⭐</div>
            <div className="kpi-body"><div className="kpi-value">{k.value}</div><div className="kpi-label">{k.label}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Course</th><th>Course</th><th>Instructor</th><th>Materials</th><th>Relevance</th><th>Difficulty</th><th>Suggestions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-loading">Loading…</td></tr>
              ) : feedback.map(f => (
                <tr key={f.id}>
                  <td>{f.course_name}</td>
                  <td><Stars rating={f.course_rating} /></td>
                  <td><Stars rating={f.instructor_rating} /></td>
                  <td><Stars rating={f.materials_rating} /></td>
                  <td><Stars rating={f.relevance_rating} /></td>
                  <td><span className={`badge ${f.difficulty === 'Too Hard' ? 'badge-red' : f.difficulty === 'Just Right' ? 'badge-green' : 'badge-gray'}`}>{f.difficulty}</span></td>
                  <td className="suggestions-cell">{f.suggestions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
