import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { COURSES, MATERIALS } from '../../data/constants'

export default function NurseSearch() {
  const { params, navigate } = useApp()
  const [query, setQuery] = useState(params.q ?? '')

  const q = query.toLowerCase()
  const matchCourses = q ? COURSES.filter(c => c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)) : []
  const matchMaterials = q ? MATERIALS.filter(m => m.title.toLowerCase().includes(q) || m.type.toLowerCase().includes(q)) : []
  const total = matchCourses.length + matchMaterials.length

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Search</h1>
          <p className="screen-subtitle">{q ? `${total} results for "${q}"` : 'Search courses and materials'}</p>
        </div>
      </div>

      <div className="search-bar-full">
        <span className="search-icon-big">🔍</span>
        <input
          className="search-input-full"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search courses, materials…"
          autoFocus
        />
      </div>

      {q && (
        <>
          {matchCourses.length > 0 && (
            <div className="card search-section">
              <h4 className="search-section-title">Courses</h4>
              {matchCourses.map(c => (
                <div key={c.id} className="search-result-item" onClick={() => navigate('ncourse', { courseId: c.id })}>
                  <div className="search-result-icon">📚</div>
                  <div>
                    <div className="search-result-title">{c.title}</div>
                    <div className="search-result-meta">{c.code} · {c.category} · {c.duration}</div>
                  </div>
                  <span className="search-result-arrow">›</span>
                </div>
              ))}
            </div>
          )}

          {matchMaterials.length > 0 && (
            <div className="card search-section">
              <h4 className="search-section-title">Materials</h4>
              {matchMaterials.map(m => (
                <div key={m.id} className="search-result-item">
                  <div className="search-result-icon">📎</div>
                  <div>
                    <div className="search-result-title">{m.title}</div>
                    <div className="search-result-meta">{m.type} · {m.size_text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total === 0 && <div className="empty-state">No results for "{query}"</div>}
        </>
      )}
    </div>
  )
}
