import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface NurseProgress {
  profile_id: string; full_name: string; email: string; dept_id: string
  unit_name: string; job_title: string; assigned: number; done: number
  overdue: number; avg_score: number; last_activity: string
}

interface CourseLockRow {
  id: string
  profile_id: string
  course_id: string
  reason: string
  locked_at: string
  nurse_name: string
  course_title: string
}

export default function ProgressScreen() {
  const { toast, profile } = useApp()
  const [nurses, setNurses] = useState<NurseProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [lockedCourses, setLockedCourses] = useState<CourseLockRow[]>([])
  const [loadingLocks, setLoadingLocks] = useState(true)
  const [unlocking, setUnlocking] = useState<string | null>(null)

  const canUnlock = ['superadmin', 'admin', 'educator', 'supervisor'].includes(profile?.role ?? '')

  useEffect(() => { fetchProgress() }, [])
  useEffect(() => { if (canUnlock) fetchLockedCourses() }, [canUnlock])

  async function fetchLockedCourses() {
    setLoadingLocks(true)
    const { data } = await supabase
      .from('course_locks')
      .select('id, profile_id, course_id, reason, locked_at, profiles(full_name), courses(title)')
      .eq('is_locked', true)
      .order('locked_at', { ascending: false })
    const rows: CourseLockRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      profile_id: r.profile_id,
      course_id: r.course_id,
      reason: r.reason,
      locked_at: r.locked_at,
      nurse_name: r.profiles?.full_name ?? 'Unknown',
      course_title: r.courses?.title ?? 'Unknown Course',
    }))
    setLockedCourses(rows)
    setLoadingLocks(false)
  }

  async function handleUnlock(lock: CourseLockRow) {
    setUnlocking(lock.id)
    const { error } = await supabase
      .from('course_locks')
      .update({
        is_locked: false,
        unlocked_at: new Date().toISOString(),
        unlocked_by: profile?.full_name ?? 'Admin',
      })
      .eq('id', lock.id)
    setUnlocking(null)
    if (error) { toast('Failed to unlock course'); return }
    toast(`Unlocked "${lock.course_title}" for ${lock.nurse_name}`)
    fetchLockedCourses()
  }

  async function fetchProgress() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_nurse_progress')
    if (!error && data && data.length > 0) {
      setNurses(data)
    } else {
      // Fallback: fetch profiles + enrollments + lesson progress manually
      const [profRes, enrRes, lpRes, modsRes, lsnsRes] = await Promise.all([
        supabase.from('profiles').select('id,full_name,email,dept_id,unit_name,job_title,updated_at').eq('role', 'nurse').order('full_name'),
        supabase.from('nurse_enrollments').select('profile_id,status,due_date'),
        supabase.from('lesson_progress').select('profile_id,course_key,completed,quiz_score,updated_at'),
        supabase.from('course_modules').select('id,course_id'),
        supabase.from('lessons').select('id,module_id'),
      ])
      const enr = enrRes.data ?? []
      const lp = lpRes.data ?? []

      // Build course_id -> total lesson count
      const modToCourse: Record<string, string> = {}
      for (const m of (modsRes.data ?? [])) modToCourse[m.id] = m.course_id
      const lessonCounts: Record<string, number> = {}
      for (const l of (lsnsRes.data ?? [])) {
        const cid = modToCourse[l.module_id]
        if (cid) lessonCounts[cid] = (lessonCounts[cid] ?? 0) + 1
      }

      const rows: NurseProgress[] = (profRes.data ?? []).map(p => {
        const myEnr = enr.filter(e => e.profile_id === p.id)
        const myLp = lp.filter(l => l.profile_id === p.id)

        // Group lesson_progress by course_key
        const byCourse: Record<string, { total: number; done: number }> = {}
        for (const row of myLp) {
          if (!byCourse[row.course_key]) byCourse[row.course_key] = { total: 0, done: 0 }
          byCourse[row.course_key].total++
          if (row.completed) byCourse[row.course_key].done++
        }
        // A course counts as "done" when completed lessons >= total lessons in that course
        const coursesDone = Object.entries(byCourse).filter(([courseKey, v]) => {
          const total = lessonCounts[courseKey] ?? 0
          return total > 0 && v.done >= total
        }).length

        const scores = myLp.filter(l => l.quiz_score != null).map(l => l.quiz_score as number)
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
        const overdue = myEnr.filter(e => e.due_date && new Date(e.due_date) < new Date() && e.status !== 'completed').length
        const lastLp = myLp.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]

        return {
          profile_id: p.id, full_name: p.full_name, email: p.email,
          dept_id: p.dept_id ?? '', unit_name: p.unit_name ?? '', job_title: p.job_title ?? '',
          assigned: myEnr.length, done: coursesDone, overdue,
          avg_score: avgScore, last_activity: lastLp?.updated_at ?? p.updated_at,
        }
      })
      setNurses(rows)
    }
    setLoading(false)
  }

  const depts = ['all', ...Array.from(new Set(nurses.map(n => n.dept_id).filter(Boolean)))]
  const filtered = nurses.filter(n => {
    const q = search.toLowerCase()
    return (!q || n.full_name.toLowerCase().includes(q) || n.dept_id?.toLowerCase().includes(q))
      && (deptFilter === 'all' || n.dept_id === deptFilter)
  })

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Learner Progress</h1>
          <p className="screen-subtitle">Real-time training completion tracking</p>
        </div>
      </div>

      <div className="table-toolbar">
        <input className="search-input" placeholder="Search nurses…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          {depts.map(d => <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nurse</th><th>Department</th><th>Unit</th><th>Assigned</th>
                <th>Completed</th><th>Overdue</th><th>Progress</th><th>Avg Score</th><th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-loading">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">No nurses found</td></tr>
              ) : filtered.map(n => {
                const pct = n.assigned > 0 ? Math.round((n.done / n.assigned) * 100) : 0
                return (
                  <tr key={n.profile_id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm">{n.full_name?.[0] ?? '?'}</div>
                        <div>
                          <div>{n.full_name}</div>
                          <div className="user-sub">{n.job_title}</div>
                        </div>
                      </div>
                    </td>
                    <td>{n.dept_id || '—'}</td>
                    <td>{n.unit_name || '—'}</td>
                    <td>{n.assigned}</td>
                    <td>{n.done}</td>
                    <td>
                      {n.overdue > 0
                        ? <span className="badge badge-red">{n.overdue}</span>
                        : <span className="badge badge-gray">0</span>}
                    </td>
                    <td>
                      <div className="progress-cell">
                        <div className="bar-track sm">
                          <div className="bar-fill" style={{
                            width: `${pct}%`,
                            background: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)',
                          }} />
                        </div>
                        <span>{pct}%</span>
                      </div>
                    </td>
                    <td>{n.avg_score > 0 ? `${n.avg_score}%` : '—'}</td>
                    <td>{n.last_activity ? new Date(n.last_activity).toLocaleDateString() : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canUnlock && (
        <div className="card" style={{ marginTop: 32 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0 }}>Locked Courses</h3>
            {!loadingLocks && lockedCourses.length > 0 && (
              <span className="badge badge-red">{lockedCourses.length}</span>
            )}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Nurse</th><th>Course</th><th>Reason</th><th>Locked On</th><th>Action</th></tr>
              </thead>
              <tbody>
                {loadingLocks ? (
                  <tr><td colSpan={5} className="table-loading">Loading…</td></tr>
                ) : lockedCourses.length === 0 ? (
                  <tr><td colSpan={5} className="table-empty">No locked courses</td></tr>
                ) : lockedCourses.map(lock => (
                  <tr key={lock.id}>
                    <td>{lock.nurse_name}</td>
                    <td>{lock.course_title}</td>
                    <td style={{ maxWidth: 240, fontSize: 13, color: 'var(--muted)' }}>{lock.reason}</td>
                    <td>{new Date(lock.locked_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleUnlock(lock)}
                        disabled={unlocking === lock.id}
                        style={{ opacity: unlocking === lock.id ? 0.6 : 1 }}
                      >
                        {unlocking === lock.id ? 'Unlocking…' : 'Unlock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
