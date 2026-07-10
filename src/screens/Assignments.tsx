import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface NurseRow { id: string; name: string; emp: string; dept: string; title: string; assigned: number; done: number; overdue: number }
interface CourseRow { id: string; title: string; code: string }
interface Enrollment { id: string; course_id: string; due_date: string | null; status: string; mandatory: boolean; completion_pct: number; courseTitle?: string; courseCode?: string }

export default function AssignmentsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [nurses, setNurses] = useState<NurseRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [nursesRes, coursesRes, enrollRes] = await Promise.all([
      supabase.from('profiles').select('id,full_name,employee_id,dept_id,job_title').eq('role', 'nurse').order('full_name'),
      supabase.from('courses').select('id,title,code').order('title'),
      supabase.from('nurse_enrollments').select('profile_id,status,due_date'),
    ])

    const enroll = enrollRes.data ?? []
    const nurseList: NurseRow[] = (nursesRes.data ?? []).map(p => {
      const mine = enroll.filter(e => e.profile_id === p.id)
      const overdue = mine.filter(e => e.due_date && new Date(e.due_date) < new Date() && e.status !== 'completed').length
      return {
        id: p.id, name: p.full_name, emp: p.employee_id ?? '', dept: p.dept_id ?? '',
        title: p.job_title ?? '', assigned: mine.length, done: mine.filter(e => e.status === 'completed').length, overdue,
      }
    })

    setNurses(nurseList)
    setCourses(coursesRes.data ?? [])
    setLoading(false)
  }

  const filtered = nurses.filter(n => {
    const q = search.toLowerCase()
    return !q || n.name.toLowerCase().includes(q) || n.emp.toLowerCase().includes(q) || n.dept.toLowerCase().includes(q)
  })

  function openAssign(nurse: NurseRow) {
    openModal({
      title: `Assign Courses — ${nurse.name}`, wide: true,
      body: (
        <AssignForm
          nurseId={nurse.id}
          nurseName={nurse.name}
          courses={courses}
          onSave={async (courseIds, deadline, mandatory) => {
            const rows = courseIds.map(courseId => ({
              profile_id: nurse.id,
              course_id: courseId,
              due_date: deadline || null,
              status: 'not_started',
              mandatory,
              completion_pct: 0,
              last_activity: 'Assigned',
            }))
            await supabase.from('nurse_enrollments').upsert(rows, { onConflict: 'profile_id,course_id' })
            await supabase.from('audit_logs').insert({
              user_name: 'Admin', action: 'ASSIGN_COURSES',
              affected_record: `${nurse.name} — ${courseIds.length} course(s)`, ip_address: '—',
            })
            fetchData()
            closeModal()
            toast(`${courseIds.length} course(s) assigned to ${nurse.name}`)
          }}
        />
      ),
    })
  }

  function openManage(nurse: NurseRow) {
    openModal({
      title: `Manage Assignments — ${nurse.name}`, wide: true,
      body: (
        <ManageEnrollments
          nurseId={nurse.id}
          nurseName={nurse.name}
          courses={courses}
          onRefresh={() => { fetchData(); closeModal() }}
          toast={toast}
        />
      ),
    })
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Assignments</h1>
          <p className="screen-subtitle">Manage course assignments per nurse</p>
        </div>
      </div>

      <div className="table-toolbar">
        <input className="search-input" placeholder="Search nurses…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nurse</th><th>Employee ID</th><th>Department</th><th>Title</th>
                <th>Assigned</th><th>Completed</th><th>Overdue</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-loading">No nurses found</td></tr>
              ) : filtered.map(n => (
                <tr key={n.id}>
                  <td><div className="user-cell"><div className="user-avatar-sm">{n.name[0]}</div>{n.name}</div></td>
                  <td>{n.emp || '—'}</td>
                  <td>{n.dept || '—'}</td>
                  <td>{n.title || '—'}</td>
                  <td><span className="badge badge-blue">{n.assigned}</span></td>
                  <td><span className="badge badge-green">{n.done}</span></td>
                  <td><span className={`badge ${n.overdue > 0 ? 'badge-red' : 'badge-gray'}`}>{n.overdue}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm btn-primary" onClick={() => openAssign(n)}>+ Assign</button>
                      <button className="btn btn-sm btn-outline" onClick={() => openManage(n)}>Manage</button>
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

function ManageEnrollments({
  nurseId, nurseName, courses, onRefresh, toast,
}: {
  nurseId: string; nurseName: string; courses: CourseRow[]
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
    const { data } = await supabase
      .from('nurse_enrollments')
      .select('id,course_id,due_date,status,mandatory,completion_pct')
      .eq('profile_id', nurseId)
      .order('course_id')
    const courseMap = Object.fromEntries(courses.map(c => [c.id, c]))
    setEnrollments((data ?? []).map(e => ({
      ...e,
      courseTitle: courseMap[e.course_id]?.title ?? e.course_id,
      courseCode: courseMap[e.course_id]?.code ?? '',
    })))
    setLoading(false)
  }

  function startEdit(e: Enrollment) {
    setEditingId(e.id)
    setEditDeadline(e.due_date ?? '')
    setEditMandatory(e.mandatory)
  }

  async function saveEdit(e: Enrollment) {
    await supabase.from('nurse_enrollments').update({ due_date: editDeadline || null, mandatory: editMandatory }).eq('id', e.id)
    setEditingId(null)
    loadEnrollments()
    toast('Assignment updated')
  }

  async function removeEnrollment(e: Enrollment) {
    if (!confirm(`Remove "${e.courseTitle}" from ${nurseName}?`)) return
    await supabase.from('nurse_enrollments').delete().eq('id', e.id)
    loadEnrollments()
    toast('Assignment removed')
  }

  const statusColor: Record<string, string> = { completed: 'badge-green', in_progress: 'badge-blue', not_started: 'badge-gray', overdue: 'badge-red' }

  if (loading) return <div className="loading-state">Loading…</div>

  if (enrollments.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 0' }}>
        No courses assigned yet. Use the <strong>+ Assign</strong> button to add courses.
      </div>
    )
  }

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
                <label className="enrollment-check-label">
                  <input type="checkbox" checked={editMandatory} onChange={ev => setEditMandatory(ev.target.checked)} /> Mandatory
                </label>
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
                <button className="btn btn-sm btn-outline" onClick={() => startEdit(e)}>Edit</button>
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

function AssignForm({
  nurseName, courses, onSave,
}: {
  nurseId: string; nurseName: string; courses: CourseRow[]
  onSave: (courseIds: string[], deadline: string, mandatory: boolean) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [deadline, setDeadline] = useState('')
  const [mandatory, setMandatory] = useState(true)
  const [search, setSearch] = useState('')

  const filtered = courses.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(selected, deadline, mandatory) }}>
      <p>Select courses to assign to <strong>{nurseName}</strong>:</p>
      <input
        className="search-input"
        style={{ marginBottom: 8 }}
        placeholder="Filter courses…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="assign-course-list">
        {filtered.map(c => (
          <label key={c.id} className="assign-course-item">
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={e => setSelected(sel => e.target.checked ? [...sel, c.id] : sel.filter(s => s !== c.id))}
            />
            <div>
              <div>{c.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.code}</div>
            </div>
          </label>
        ))}
        {filtered.length === 0 && <div className="empty-state">No courses found</div>}
      </div>
      <div className="form-row">
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
        <button type="submit" className="btn btn-primary" disabled={selected.length === 0}>
          Assign {selected.length} Course{selected.length !== 1 ? 's' : ''}
        </button>
      </div>
    </form>
  )
}
