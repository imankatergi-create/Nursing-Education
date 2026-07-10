import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

interface CourseResult { id: string; title: string; code: string; category: string; level: string; status: string }
interface UserResult { id: string; full_name: string; email: string; dept_id?: string; job_title?: string; role: string }
interface MaterialResult { id: string; title: string; type: string; size_text?: string }

export default function CmsSearchScreen() {
  const { params, navigate } = useApp()
  const [query, setQuery] = useState(params.q ?? '')
  const [tab, setTab] = useState<'all'|'courses'|'users'|'materials'>('all')
  const [courses, setCourses] = useState<CourseResult[]>([])
  const [users, setUsers] = useState<UserResult[]>([])
  const [materials, setMaterials] = useState<MaterialResult[]>([])
  const [searching, setSearching] = useState(false)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setCourses([]); setUsers([]); setMaterials([]); return }
    setSearching(true)
    const pattern = `%${q}%`
    const [cRes, uRes, mRes] = await Promise.all([
      supabase.from('courses').select('id,title,code,category,level,status').or(`title.ilike.${pattern},code.ilike.${pattern},category.ilike.${pattern}`).limit(20),
      supabase.from('profiles').select('id,full_name,email,dept_id,job_title,role').or(`full_name.ilike.${pattern},email.ilike.${pattern},dept_id.ilike.${pattern}`).limit(20),
      supabase.from('materials').select('id,title,type,size_text').or(`title.ilike.${pattern},type.ilike.${pattern}`).limit(20),
    ])
    setCourses(cRes.data ?? [])
    setUsers(uRes.data ?? [])
    setMaterials(mRes.data ?? [])
    setSearching(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  const total = courses.length + users.length + materials.length
  const statusColor: Record<string, string> = { active: 'badge-green', draft: 'badge-amber', archived: 'badge-gray', inactive: 'badge-red' }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Search</h1>
          <p className="screen-subtitle">{query ? (searching ? 'Searching…' : `${total} results for "${query}"`) : 'Enter a search query'}</p>
        </div>
      </div>

      <div className="search-bar-full">
        <span className="search-icon-big">🔍</span>
        <input
          className="search-input-full"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search courses, users, materials…"
          autoFocus
        />
        {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
      </div>

      {query && !searching && (
        <>
          <div className="tab-row">
            {(['all','courses','users','materials'] as const).map(t => (
              <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                <span className="tab-count">
                  {t === 'all' ? total : t === 'courses' ? courses.length : t === 'users' ? users.length : materials.length}
                </span>
              </button>
            ))}
          </div>

          {(tab === 'all' || tab === 'courses') && courses.length > 0 && (
            <div className="card search-section">
              <h4 className="search-section-title">Courses</h4>
              {courses.map(c => (
                <div key={c.id} className="search-result-item" onClick={() => navigate('courses')}>
                  <div className="search-result-icon">📚</div>
                  <div>
                    <div className="search-result-title">{c.title}</div>
                    <div className="search-result-meta">{c.code} · {c.category} · {c.level}</div>
                  </div>
                  <span className={`badge ${statusColor[c.status] ?? 'badge-gray'}`}>{c.status}</span>
                </div>
              ))}
            </div>
          )}

          {(tab === 'all' || tab === 'users') && users.length > 0 && (
            <div className="card search-section">
              <h4 className="search-section-title">Users</h4>
              {users.map(u => (
                <div key={u.id} className="search-result-item" onClick={() => navigate('users')}>
                  <div className="search-result-avatar">{u.full_name?.[0] ?? '?'}</div>
                  <div>
                    <div className="search-result-title">{u.full_name}</div>
                    <div className="search-result-meta">{u.email} · {u.dept_id ?? '—'} · {u.job_title ?? u.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(tab === 'all' || tab === 'materials') && materials.length > 0 && (
            <div className="card search-section">
              <h4 className="search-section-title">Materials</h4>
              {materials.map(m => (
                <div key={m.id} className="search-result-item" onClick={() => navigate('materials')}>
                  <div className="search-result-icon">📎</div>
                  <div>
                    <div className="search-result-title">{m.title}</div>
                    <div className="search-result-meta">{m.type}{m.size_text ? ` · ${m.size_text}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total === 0 && (
            <div className="empty-state">No results found for "{query}"</div>
          )}
        </>
      )}

      {query && searching && (
        <div className="loading-state">Searching…</div>
      )}
    </div>
  )
}
