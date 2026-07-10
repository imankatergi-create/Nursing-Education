import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import type { Course, Material } from '../../types'

export default function NurseSearch() {
  const { params, navigate } = useApp()
  const [query, setQuery] = useState(params.q ?? '')
  const [courses, setCourses] = useState<Course[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query) return
    const t = setTimeout(doSearch, 300)
    return () => clearTimeout(t)
  }, [query])

  async function doSearch() {
    if (!query) return
    setLoading(true)
    const q = query.toLowerCase()
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('courses').select('*').ilike('title', `%${q}%`).limit(20),
      supabase.from('materials').select('*').ilike('title', `%${q}%`).limit(20),
    ])
    setCourses(c ?? [])
    setMaterials(m ?? [])
    setLoading(false)
  }

  const total = courses.length + materials.length

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Search</h1>
          <p className="screen-subtitle">{query ? `${total} results for "${query}"` : 'Search courses and materials'}</p>
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

      {query && !loading && (
        <>
          {courses.length > 0 && (
            <div className="card search-section">
              <h4 className="search-section-title">Courses</h4>
              {courses.map(c => (
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

          {materials.length > 0 && (
            <div className="card search-section">
              <h4 className="search-section-title">Materials</h4>
              {materials.map(m => (
                <div key={m.id} className="search-result-item">
                  <div className="search-result-icon">📎</div>
                  <div>
                    <div className="search-result-title">{m.title}</div>
                    <div className="search-result-meta">{m.type}{m.size_text ? ` · ${m.size_text}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total === 0 && <div className="empty-state">No results for "{query}"</div>}
        </>
      )}
      {loading && <div className="loading-state">Searching…</div>}
    </div>
  )
}
