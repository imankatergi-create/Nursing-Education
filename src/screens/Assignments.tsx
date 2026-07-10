import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { Role } from '../types'

interface UserRow {
  id: string
  name: string
  emp: string
  dept: string
  role: Role
  title: string
  assigned: number
  done: number
  overdue: number
}
interface CourseRow { id: string; title: string; code: string; mandatory: boolean }
interface Enrollment {
  id: string; course_id: string; due_date: string | null; status: string
  mandatory: boolean; completion_pct: number; courseTitle?: string; courseCode?: string
}

const ROLES: Role[] = ['nurse', 'educator', 'supervisor', 'director', 'admin', 'it']
const ROLE_LABELS: Record<string, string> = {
  nurse: 'Nurse', educator: 'Educator', supervisor: 'Supervisor',
  director: 'Director', admin: 'Admin', it: 'IT',
}
const ROLE_COLOR: Record<string, string> = {
  nurse: 'badge-teal', educator: 'badge-blue', supervisor: 'badge-amber',
  director: 'badge-purple', admin: 'badge-red', it: 'badge-gray',
}

export default function AssignmentsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [users, setUsers] = useState<UserRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [usersRes, coursesRes, enrollRes] = await Promise.all([
      supabase.from('profiles').select('id,full_name,employee_id,dept_id,role,job_title').order('full_name'),
      supabase.from('courses').select('id,title,code,mandatory').order('title'),
      supabase.from('nurse_enrollments').select('profile_id,status,due_date'),
    ])

    const enroll = enrollRes.data ?? []
    const userList: UserRow[] = (usersRes.data ?? []).map(p => {
      const mine = enroll.filter(e => e.profile_id === p.id)
      const overdue = mine.filter(e => e.due_date && new Date(e.due_date) < new Date() && e.status !== 'completed').length
      return {
        id: p.id, name: p.full_name ?? '—', emp: p.employee_id ?? '', dept: p.dept_id ?? '',
        role: p.role as Role, title: p.job_title ?? '',
        assigned: mine.length, done: mine.filter(e => e.status === 'completed').length, overdue,
      }
    })

    setUsers(userList)
    setCourses(coursesRes.data ?? [])
    setLoading(false)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.emp.toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length
    return acc
  }, {} as Record<string, number>)

  function openBulkAssign() {
    openModal({
      title: 'Bulk Assign by Role',
      wide: true,
      body: (
        <BulkAssignForm
          courses={courses}
          users={users}
          onSave={async (courseIds, roleIds, deadline, mandatory) => {
            const targets = users.filter(u => roleIds.includes(u.role))
            const rows = targets.flatMap(u =>
              courseIds.map(courseId => ({
                profile_id: u.id,
                course_id: courseId,
                due_date: deadline || null,
                status: 'not_started',
                mandatory,
                completion_pct: 0,
                last_activity: 'Bulk assigned',
              }))
            )
            if (rows.length === 0) { toast('No users match the selected roles'); return }
            await supabase.from('nurse_enrollments').upsert(rows, { onConflict: 'profile_id,course_id' })
            await supabase.from('audit_logs').insert({
              user_name: 'Admin',
              action: 'BULK_ASSIGN_COURSES',
              affected_record: `${roleIds.join(', ')} — ${courseIds.length} course(s) → ${targets.length} user(s)`,
              ip_address: '—',
            })
            fetchData()
            closeModal()
            toast(`${courseIds.length} course${courseIds.length !== 1 ? 's' : ''} assigned to ${targets.length} user${targets.length !== 1 ? 's' : ''}`)
          }}
        />
      ),
    })
  }

  function openAssign(user: UserRow) {
    openModal({
      title: `Assign Courses — ${user.name}`,
      wide: true,
      body: (
        <AssignForm
          userName={user.name}
          courses={courses}
          onSave={async (courseIds, deadline, mandatory) => {
            const rows = courseIds.map(courseId => ({
              profile_id: user.id, course_id: courseId,
              due_date: deadline || null, status: 'not_started',
              mandatory, completion_pct: 0, last_activity: 'Assigned',
            }))
            await supabase.from('nurse_enrollments').upsert(rows, { onConflict: 'profile_id,course_id' })
            await supabase.from('audit_logs').insert({
              user_name: 'Admin', action: 'ASSIGN_COURSES',
              affected_record: `${user.name} — ${courseIds.length} course(s)`, ip_address: '—',
            })
            fetchData(); closeModal()
            toast(`${courseIds.length} course(s) assigned to ${user.name}`)
          }}
        />
      ),
    })
  }

  function openManage(user: UserRow) {
    openModal({
      title: `Manage Assignments — ${user.name}`,
      wide: true,
      body: <ManageEnrollments userId={user.id} userName={user.name} courses={courses} onRefresh={() => { fetchData(); closeModal() }} toast={toast} />,
    })
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Assignments</h1>
          <p className="screen-subtitle">Assign courses individually or in bulk by role</p>
        </div>
        <button className="btn btn-primary" onClick={openBulkAssign}>
          Bulk Assign by Role
        </button>
      </div>

      {/* Role filter tabs */}
      <div className="tab-row">
        <button className={`tab-btn${roleFilter === 'all' ? ' active' : ''}`} onClick={() => setRoleFilter('all')}>
          All Users <span className="tab-count">{users.length}</span>
        </button>
        {ROLES.map(r => (
          <button key={r} className={`tab-btn${roleFilter === r ? ' active' : ''}`} onClick={() => setRoleFilter(r)}>
            {ROLE_LABELS[r]} <span className="tab-count">{roleCounts[r] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="table-toolbar">
        <input className="search-input" placeholder="Search by name or employee ID…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Role</th><th>Employee ID</th><th>Job Title</th>
                <th>Assigned</th><th>Completed</th><th>Overdue</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-loading">No users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-sm">{u.name[0]}</div>
                      {u.name}
                    </div>
                  </td>
                  <td><span className={`badge ${ROLE_COLOR[u.role] ?? 'badge-gray'}`}>{ROLE_LABELS[u.role] ?? u.role}</span></td>
                  <td>{u.emp || '—'}</td>
                  <td>{u.title || '—'}</td>
                  <td><span className="badge badge-blue">{u.assigned}</span></td>
                  <td><span className="badge badge-green">{u.done}</span></td>
                  <td><span className={`badge ${u.overdue > 0 ? 'badge-red' : 'badge-gray'}`}>{u.overdue}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm btn-primary" onClick={() => openAssign(u)}>+ Assign</button>
                      <button className="btn btn-sm btn-outline" onClick={() => openManage(u)}>Manage</button>
                    </div>
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

// ── BulkAssignForm ────────────────────────────────────────────────────────────

function BulkAssignForm({
  courses, users, onSave,
}: {
  courses: CourseRow[]
  users: UserRow[]
  onSave: (courseIds: string[], roles: Role[], deadline: string, mandatory: boolean) => void
}) {
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([])
  const [deadline, setDeadline] = useState('')
  const [mandatory, setMandatory] = useState(true)
  const [courseSearch, setCourseSearch] = useState('')
  const [step, setStep] = useState<'roles' | 'courses' | 'confirm'>('roles')

  const filteredCourses = courses.filter(c =>
    !courseSearch || c.title.toLowerCase().includes(courseSearch.toLowerCase()) || c.code.toLowerCase().includes(courseSearch.toLowerCase())
  )

  const targetUsers = users.filter(u => selectedRoles.includes(u.role))

  function toggleRole(r: Role) {
    setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }
  function toggleCourse(id: string) {
    setSelectedCourses(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function selectAllCourses() { setSelectedCourses(courses.map(c => c.id)) }
  function selectAllRoles() { setSelectedRoles([...ROLES]) }

  const canProceedRoles = selectedRoles.length > 0
  const canProceedCourses = selectedCourses.length > 0

  return (
    <div className="bulk-assign">
      {/* Step indicator */}
      <div className="bulk-steps">
        {(['roles', 'courses', 'confirm'] as const).map((s, i) => (
          <div key={s} className={`bulk-step${step === s ? ' active' : ((['roles', 'courses'].indexOf(step) ?? 0) > i ? ' done' : '')}`}>
            <div className="bulk-step-num">{i + 1}</div>
            <div className="bulk-step-label">{s === 'roles' ? 'Select Roles' : s === 'courses' ? 'Select Courses' : 'Confirm'}</div>
          </div>
        ))}
      </div>

      {/* Step 1: Select Roles */}
      {step === 'roles' && (
        <div>
          <p className="bulk-hint">Choose which roles to assign courses to. All users with those roles will be enrolled.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button type="button" className="btn btn-sm btn-outline" onClick={selectAllRoles}>Select All Roles</button>
          </div>
          <div className="bulk-role-grid">
            {ROLES.map(r => {
              const count = users.filter(u => u.role === r).length
              const checked = selectedRoles.includes(r)
              return (
                <label key={r} className={`bulk-role-card${checked ? ' selected' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleRole(r)} className="bulk-role-check" />
                  <div className="bulk-role-icon">{r === 'nurse' ? '🩺' : r === 'educator' ? '🎓' : r === 'supervisor' ? '👔' : r === 'director' ? '🏥' : r === 'admin' ? '⚙️' : '💻'}</div>
                  <div className="bulk-role-name">{ROLE_LABELS[r]}</div>
                  <div className="bulk-role-count">{count} user{count !== 1 ? 's' : ''}</div>
                </label>
              )
            })}
          </div>
          {selectedRoles.length > 0 && (
            <div className="bulk-selection-summary">
              <strong>{targetUsers.length} user{targetUsers.length !== 1 ? 's' : ''}</strong> will be assigned
              ({selectedRoles.map(r => ROLE_LABELS[r]).join(', ')})
            </div>
          )}
          <div className="modal-form-actions">
            <button className="btn btn-primary" disabled={!canProceedRoles} onClick={() => setStep('courses')}>
              Next: Select Courses →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Courses */}
      {step === 'courses' && (
        <div>
          <p className="bulk-hint">
            Select courses to assign to <strong>{targetUsers.length} user{targetUsers.length !== 1 ? 's' : ''}</strong>
            ({selectedRoles.map(r => ROLE_LABELS[r]).join(', ')})
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <input className="search-input" placeholder="Filter courses…" value={courseSearch} onChange={e => setCourseSearch(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm btn-outline" onClick={selectAllCourses}>Select All</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 300, overflowY: 'auto', marginBottom: 14 }}>
            {filteredCourses.map(c => {
              const checked = selectedCourses.includes(c.id)
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `1.5px solid ${checked ? 'var(--teal)' : 'var(--border)'}`, borderRadius: 8, background: checked ? 'var(--teal-t)' : 'var(--panel)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleCourse(c.id)} style={{ accentColor: 'var(--teal)', width: 16, height: 16 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.code}</div>
                  </div>
                  {c.mandatory && <span className="tag tag-red" style={{ fontSize: 10 }}>Mandatory</span>}
                </label>
              )
            })}
            {filteredCourses.length === 0 && <div className="empty-state">No courses found.</div>}
          </div>
          <div className="modal-form-actions" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep('roles')}>← Back</button>
            <button className="btn btn-primary" disabled={!canProceedCourses} onClick={() => setStep('confirm')}>
              Next: Confirm →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && (
        <div>
          <div className="bulk-confirm-summary">
            <div className="bulk-confirm-row">
              <span className="bulk-confirm-label">Roles</span>
              <span>{selectedRoles.map(r => ROLE_LABELS[r]).join(', ')}</span>
            </div>
            <div className="bulk-confirm-row">
              <span className="bulk-confirm-label">Users affected</span>
              <strong style={{ color: 'var(--teal)' }}>{targetUsers.length} user{targetUsers.length !== 1 ? 's' : ''}</strong>
            </div>
            <div className="bulk-confirm-row">
              <span className="bulk-confirm-label">Courses</span>
              <span>{selectedCourses.length} selected</span>
            </div>
            <div className="bulk-confirm-row">
              <span className="bulk-confirm-label">Total enrollments</span>
              <strong style={{ color: 'var(--teal)' }}>{targetUsers.length * selectedCourses.length}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1, gap: 0, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ flex: 1, padding: 12, borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>COURSES TO ASSIGN</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
                {courses.filter(c => selectedCourses.includes(c.id)).map(c => (
                  <div key={c.id} style={{ fontSize: 12, color: 'var(--text)' }}>📚 {c.title}</div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>USERS AFFECTED</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
                {targetUsers.slice(0, 20).map(u => (
                  <div key={u.id} style={{ fontSize: 12, color: 'var(--text)' }}>👤 {u.name} <span style={{ color: 'var(--muted)' }}>({ROLE_LABELS[u.role]})</span></div>
                ))}
                {targetUsers.length > 20 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>+{targetUsers.length - 20} more</div>}
              </div>
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label>Deadline (optional)</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end', paddingTop: 28 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={mandatory} onChange={e => setMandatory(e.target.checked)} style={{ accentColor: 'var(--teal)' }} />
                Mark as Mandatory
              </label>
            </div>
          </div>

          <div className="modal-form-actions" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-outline" onClick={() => setStep('courses')}>← Back</button>
            <button
              className="btn btn-primary"
              onClick={() => onSave(selectedCourses, selectedRoles, deadline, mandatory)}
            >
              Assign {selectedCourses.length} Course{selectedCourses.length !== 1 ? 's' : ''} to {targetUsers.length} User{targetUsers.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ManageEnrollments ─────────────────────────────────────────────────────────

function ManageEnrollments({
  userId, userName, courses, onRefresh, toast,
}: {
  userId: string; userName: string; courses: CourseRow[]
  onRefresh: () => void; toast: (msg: string) => void
}) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDeadline, setEditDeadline] = useState('')
  const [editMandatory, setEditMandatory] = useState(false)

  useEffect(() => { loadEnrollments() }, [])

  async function loadEnrollments() {
    setLoading(true)
    const { data } = await supabase.from('nurse_enrollments').select('id,course_id,due_date,status,mandatory,completion_pct').eq('profile_id', userId).order('course_id')
    const courseMap = Object.fromEntries(courses.map(c => [c.id, c]))
    setEnrollments((data ?? []).map(e => ({ ...e, courseTitle: courseMap[e.course_id]?.title ?? e.course_id, courseCode: courseMap[e.course_id]?.code ?? '' })))
    setLoading(false)
  }

  async function saveEdit(e: Enrollment) {
    await supabase.from('nurse_enrollments').update({ due_date: editDeadline || null, mandatory: editMandatory }).eq('id', e.id)
    setEditingId(null); loadEnrollments(); toast('Assignment updated')
  }

  async function removeEnrollment(e: Enrollment) {
    if (!confirm(`Remove "${e.courseTitle}" from ${userName}?`)) return
    await supabase.from('nurse_enrollments').delete().eq('id', e.id)
    loadEnrollments(); toast('Assignment removed')
  }

  const statusColor: Record<string, string> = { completed: 'badge-green', in_progress: 'badge-blue', not_started: 'badge-gray', overdue: 'badge-red' }

  if (loading) return <div className="loading-state">Loading…</div>
  if (enrollments.length === 0) return <div className="empty-state" style={{ padding: '32px 0' }}>No courses assigned yet.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {enrollments.map(e => (
        <div key={e.id} className="enrollment-row">
          {editingId === e.id ? (
            <>
              <div className="enrollment-info">
                <div className="enrollment-title">{e.courseTitle}</div>
                <div className="enrollment-meta">{e.courseCode}</div>
              </div>
              <div className="enrollment-edit-fields">
                <input type="date" value={editDeadline} onChange={ev => setEditDeadline(ev.target.value)} className="enrollment-date-input" />
                <label className="enrollment-check-label"><input type="checkbox" checked={editMandatory} onChange={ev => setEditMandatory(ev.target.checked)} /> Mandatory</label>
              </div>
              <div className="enrollment-actions">
                <button className="btn btn-sm btn-primary" onClick={() => saveEdit(e)}>Save</button>
                <button className="btn btn-sm btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="enrollment-info">
                <div className="enrollment-title">{e.courseTitle}</div>
                <div className="enrollment-meta">
                  {e.courseCode}
                  {e.due_date && <span> · Due {e.due_date}</span>}
                  {e.mandatory && <span className="tag tag-red" style={{ marginLeft: 6, fontSize: 10 }}>Mandatory</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="progress-cell" style={{ minWidth: 80 }}>
                  <div className="bar-track sm"><div className="bar-fill" style={{ width: `${e.completion_pct}%` }} /></div>
                  <span style={{ fontSize: 11 }}>{e.completion_pct}%</span>
                </div>
                <span className={`badge ${statusColor[e.status] ?? 'badge-gray'}`}>{e.status.replace('_', ' ')}</span>
              </div>
              <div className="enrollment-actions">
                <button className="btn btn-sm btn-outline" onClick={() => { setEditingId(e.id); setEditDeadline(e.due_date ?? ''); setEditMandatory(e.mandatory) }}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => removeEnrollment(e)}>Remove</button>
              </div>
            </>
          )}
        </div>
      ))}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-outline" onClick={onRefresh}>Close</button>
      </div>
    </div>
  )
}

// ── AssignForm ────────────────────────────────────────────────────────────────

function AssignForm({
  userName, courses, onSave,
}: {
  userName: string; courses: CourseRow[]
  onSave: (courseIds: string[], deadline: string, mandatory: boolean) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [deadline, setDeadline] = useState('')
  const [mandatory, setMandatory] = useState(true)
  const [search, setSearch] = useState('')

  const filtered = courses.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(selected, deadline, mandatory) }}>
      <p>Select courses to assign to <strong>{userName}</strong>:</p>
      <input className="search-input" style={{ marginBottom: 8 }} placeholder="Filter courses…" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="assign-course-list">
        {filtered.map(c => (
          <label key={c.id} className="assign-course-item">
            <input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(sel => e.target.checked ? [...sel, c.id] : sel.filter(s => s !== c.id))} />
            <div>
              <div>{c.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.code}</div>
            </div>
          </label>
        ))}
        {filtered.length === 0 && <div className="empty-state">No courses found</div>}
      </div>
      <div className="form-row">
        <div className="form-group"><label>Deadline</label><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
        <div className="form-group" style={{ justifyContent: 'flex-end', paddingTop: 28 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={mandatory} onChange={e => setMandatory(e.target.checked)} /> Mandatory
          </label>
        </div>
      </div>
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary" disabled={selected.length === 0}>
          Assign {selected.length} Course{selected.length !== 1 ? 's' : ''}
        </button>
      </div>
    </form>
  )
}
