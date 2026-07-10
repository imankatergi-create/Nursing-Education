import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface UserRow {
  id: string
  name: string
  emp: string
  dept: string
  role: string
  title: string
  coursesAssigned: number
  coursesDone: number
  coursesOverdue: number
  programsEnrolled: number
}
interface CourseRow { id: string; title: string; code: string }
interface ProgramRow { id: string; title: string; code: string }

const ROLE_BADGE: Record<string, string> = {
  nurse: 'badge-blue', educator: 'badge-teal', supervisor: 'badge-amber',
  admin: 'badge-green', superadmin: 'badge-red', director: 'badge-purple', it: 'badge-gray',
}

export default function AssignmentsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [users, setUsers] = useState<UserRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [programs, setPrograms] = useState<ProgramRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [profilesRes, coursesRes, programsRes, enrollRes, progEnrollRes] = await Promise.all([
      supabase.from('profiles').select('id,full_name,employee_id,dept_id,job_title,role').order('full_name'),
      supabase.from('courses').select('id,title,code').eq('status', 'active').order('title'),
      supabase.from('programs').select('id,title,code').order('title'),
      supabase.from('nurse_enrollments').select('profile_id,status,due_date'),
      supabase.from('program_enrollments').select('profile_id,status'),
    ])

    const enroll = enrollRes.data ?? []
    const progEnroll = progEnrollRes.data ?? []

    const userList: UserRow[] = (profilesRes.data ?? []).map(p => {
      const mine = enroll.filter(e => e.profile_id === p.id)
      const overdue = mine.filter(e => e.due_date && new Date(e.due_date) < new Date() && e.status !== 'completed').length
      return {
        id: p.id,
        name: p.full_name,
        emp: p.employee_id ?? '',
        dept: p.dept_id ?? '',
        role: p.role ?? 'nurse',
        title: p.job_title ?? '',
        coursesAssigned: mine.length,
        coursesDone: mine.filter(e => e.status === 'completed').length,
        coursesOverdue: overdue,
        programsEnrolled: progEnroll.filter(e => e.profile_id === p.id).length,
      }
    })

    setUsers(userList)
    setCourses(coursesRes.data ?? [])
    setPrograms(programsRes.data ?? [])
    setLoading(false)
  }

  const roles = ['all', ...Array.from(new Set(users.map(u => u.role))).sort()]
  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.emp.toLowerCase().includes(q)
    const matchR = roleFilter === 'all' || u.role === roleFilter
    return matchQ && matchR
  })

  function openAssign(user: UserRow) {
    openModal({
      title: `Assign — ${user.name}`, wide: true,
      body: (
        <AssignForm
          userId={user.id}
          userName={user.name}
          courses={courses}
          programs={programs}
          onSave={async (courseIds, programIds, deadline, mandatory) => {
            const tasks: PromiseLike<any>[] = []

            if (courseIds.length > 0) {
              tasks.push(
                supabase.from('nurse_enrollments').upsert(
                  courseIds.map(cid => ({
                    profile_id: user.id,
                    course_id: cid,
                    due_date: deadline || null,
                    status: 'not_started',
                    mandatory,
                    completion_pct: 0,
                    last_activity: 'Assigned',
                  })),
                  { onConflict: 'profile_id,course_id' }
                ).then()
              )
            }

            if (programIds.length > 0) {
              tasks.push(
                supabase.from('program_enrollments').upsert(
                  programIds.map(pid => ({
                    profile_id: user.id,
                    program_id: pid,
                    due_date: deadline || null,
                    status: 'not_started',
                    completion_pct: 0,
                  })),
                  { onConflict: 'profile_id,program_id' }
                ).then()
              )
            }

            await Promise.all(tasks)

            await supabase.from('audit_logs').insert({
              user_name: 'Admin',
              action: 'ASSIGN',
              affected_record: `${user.name} — ${courseIds.length} course(s), ${programIds.length} program(s)`,
              ip_address: '—',
            })

            fetchData()
            closeModal()
            const parts = []
            if (courseIds.length > 0) parts.push(`${courseIds.length} course${courseIds.length !== 1 ? 's' : ''}`)
            if (programIds.length > 0) parts.push(`${programIds.length} program${programIds.length !== 1 ? 's' : ''}`)
            toast(`Assigned ${parts.join(' and ')} to ${user.name}`)
          }}
        />
      ),
    })
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Assignments</h1>
          <p className="screen-subtitle">Assign courses and programs to any user</p>
        </div>
      </div>

      <div className="table-toolbar">
        <input
          className="search-input"
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-chips">
          {roles.map(r => (
            <button
              key={r}
              className={`chip${roleFilter === r ? ' active' : ''}`}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'all' ? 'All Roles' : r}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Employee ID</th>
                <th>Title</th>
                <th>Courses Assigned</th>
                <th>Completed</th>
                <th>Overdue</th>
                <th>Programs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-loading">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">No users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-sm">{u.name[0]}</div>
                      <div>
                        <div>{u.name}</div>
                        {u.dept && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.dept}</div>}
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-gray'}`}>{u.role}</span></td>
                  <td>{u.emp || '—'}</td>
                  <td style={{ maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.title || '—'}</td>
                  <td><span className="badge badge-blue">{u.coursesAssigned}</span></td>
                  <td><span className="badge badge-green">{u.coursesDone}</span></td>
                  <td><span className={`badge ${u.coursesOverdue > 0 ? 'badge-red' : 'badge-gray'}`}>{u.coursesOverdue}</span></td>
                  <td><span className="badge badge-teal">{u.programsEnrolled}</span></td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => openAssign(u)}>Assign</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AssignForm({
  userName, courses, programs, onSave,
}: {
  userId: string
  userName: string
  courses: CourseRow[]
  programs: ProgramRow[]
  onSave: (courseIds: string[], programIds: string[], deadline: string, mandatory: boolean) => void
}) {
  const [tab, setTab] = useState<'courses' | 'programs'>('courses')
  const [selCourses, setSelCourses] = useState<string[]>([])
  const [selPrograms, setSelPrograms] = useState<string[]>([])
  const [deadline, setDeadline] = useState('')
  const [mandatory, setMandatory] = useState(true)
  const [search, setSearch] = useState('')

  const filteredCourses = courses.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  )
  const filteredPrograms = programs.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  )

  const totalSelected = selCourses.length + selPrograms.length

  function toggleCourse(id: string) {
    setSelCourses(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  function toggleProgram(id: string) {
    setSelPrograms(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(selCourses, selPrograms, deadline, mandatory) }}>
      <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
        Select courses or programs to assign to <strong style={{ color: 'var(--text)' }}>{userName}</strong>:
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '2px solid var(--border)' }}>
        {(['courses', 'programs'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setSearch('') }}
            style={{
              padding: '8px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              color: tab === t ? 'var(--primary)' : 'var(--muted)',
              fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer',
              fontSize: 14,
              textTransform: 'capitalize',
            }}
          >
            {t}
            {t === 'courses' && selCourses.length > 0 && (
              <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 11 }}>{selCourses.length}</span>
            )}
            {t === 'programs' && selPrograms.length > 0 && (
              <span className="badge badge-teal" style={{ marginLeft: 6, fontSize: 11 }}>{selPrograms.length}</span>
            )}
          </button>
        ))}
      </div>

      <input
        className="search-input"
        style={{ marginBottom: 8 }}
        placeholder={`Filter ${tab}…`}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="assign-course-list">
        {tab === 'courses' ? (
          filteredCourses.length === 0 ? (
            <div className="empty-state">No active courses found</div>
          ) : filteredCourses.map(c => (
            <label key={c.id} className="assign-course-item">
              <input
                type="checkbox"
                checked={selCourses.includes(c.id)}
                onChange={() => toggleCourse(c.id)}
              />
              <div>
                <div style={{ fontWeight: 500 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.code}</div>
              </div>
            </label>
          ))
        ) : (
          filteredPrograms.length === 0 ? (
            <div className="empty-state">No programs found</div>
          ) : filteredPrograms.map(p => (
            <label key={p.id} className="assign-course-item">
              <input
                type="checkbox"
                checked={selPrograms.includes(p.id)}
                onChange={() => toggleProgram(p.id)}
              />
              <div>
                <div style={{ fontWeight: 500 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.code}</div>
              </div>
            </label>
          ))
        )}
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="form-group">
          <label>Deadline</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
        <div className="form-group" style={{ justifyContent: 'flex-end', paddingTop: 28 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={mandatory} onChange={e => setMandatory(e.target.checked)} />
            Mandatory
          </label>
        </div>
      </div>

      <div className="modal-form-actions">
        {totalSelected > 0 && (
          <span style={{ color: 'var(--muted)', fontSize: 13, marginRight: 'auto' }}>
            {selCourses.length > 0 && `${selCourses.length} course${selCourses.length !== 1 ? 's' : ''}`}
            {selCourses.length > 0 && selPrograms.length > 0 && ' + '}
            {selPrograms.length > 0 && `${selPrograms.length} program${selPrograms.length !== 1 ? 's' : ''}`}
            {' selected'}
          </span>
        )}
        <button type="submit" className="btn btn-primary" disabled={totalSelected === 0}>
          Assign {totalSelected > 0 ? `(${totalSelected})` : ''}
        </button>
      </div>
    </form>
  )
}
