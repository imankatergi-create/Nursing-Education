import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface UserRow {
  id: string; full_name: string; email: string; role: string; dept_id?: string
  employee_id?: string; job_title?: string; account_status?: string; last_login?: string
}

interface DeptRow { id: string; name: string }

export default function UsersScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [users, setUsers] = useState<UserRow[]>([])
  const [depts, setDepts] = useState<DeptRow[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
    supabase.from('departments').select('id,name').then(({ data }) => setDepts(data ?? []))
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data ?? [])
    setLoading(false)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    return matchQ && (roleFilter === 'all' || u.role === roleFilter)
  })

  function openInvite() {
    openModal({
      title: 'Invite New User',
      body: (
        <InviteForm
          depts={depts}
          onSave={async (data) => {
            const { data: fnData, error: fnErr } = await supabase.functions.invoke('admin-users', {
              body: { action: 'invite', ...data },
            })
            if (fnErr || fnData?.error) {
              toast(`Error: ${fnData?.error ?? fnErr?.message}`)
              return
            }
            fetchUsers()
            closeModal()
            toast(`Invitation sent to ${data.email}`)
          }}
        />
      ),
    })
  }

  async function toggleStatus(u: UserRow) {
    const next = u.account_status === 'Active' ? 'Inactive' : 'Active'
    await supabase.from('profiles').update({ account_status: next }).eq('id', u.id)
    fetchUsers()
    toast(`User ${next === 'Active' ? 'activated' : 'deactivated'}`)
  }

  async function deleteUser(u: UserRow) {
    if (!confirm(`Delete ${u.full_name}? This cannot be undone.`)) return
    await supabase.functions.invoke('admin-users', { body: { action: 'delete', user_id: u.id } })
    fetchUsers()
    toast('User deleted')
  }

  async function resetPassword(u: UserRow) {
    const { data: fnData, error: fnErr } = await supabase.functions.invoke('admin-users', {
      body: { action: 'reset_password', email: u.email },
    })
    if (fnErr || fnData?.error) toast(`Error: ${fnData?.error ?? fnErr?.message}`)
    else toast(`Password reset email sent to ${u.email}`)
  }

  function openEdit(u: UserRow) {
    openModal({
      title: 'Edit User',
      body: (
        <UserEditForm
          initial={u}
          depts={depts}
          onSave={async (data) => {
            // Strip read-only/system fields — sending id or last_login in the
            // payload causes PostgREST to attempt a PK update which silently
            // prevents the row from being committed.
            const { id: _id, email: _email, last_login: _ll, ...updateData } = data as UserRow & { last_login?: string }
            const { error } = await supabase.from('profiles').update(updateData).eq('id', u.id)
            if (error) { toast(`Error: ${error.message}`); return }
            await fetchUsers()
            closeModal()
            toast('User updated')
          }}
        />
      ),
    })
  }

  const statusColor: Record<string, string> = { Active: 'badge-green', Inactive: 'badge-red', Suspended: 'badge-amber' }
  const roleColors: Record<string, string> = {
    superadmin: 'badge-red', admin: 'badge-amber', educator: 'badge-blue',
    supervisor: 'badge-teal', nurse: 'badge-green', director: 'badge-purple', it: 'badge-gray',
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">User Management</h1>
          <p className="screen-subtitle">{users.length} registered users</p>
        </div>
        <button className="btn btn-primary" onClick={openInvite}>+ Invite User</button>
      </div>

      <div className="card">
        <div className="table-toolbar">
          <input className="search-input" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            {['superadmin', 'admin', 'educator', 'supervisor', 'nurse', 'director', 'it'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Employee ID</th>
                <th>Job Title</th><th>Status</th><th>Last Login</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-loading">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-empty">No users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td><div className="user-cell"><div className="user-avatar-sm">{u.full_name?.[0] ?? '?'}</div>{u.full_name}</div></td>
                  <td>{u.email}</td>
                  <td><span className={`badge ${roleColors[u.role] ?? 'badge-gray'}`}>{u.role}</span></td>
                  <td>{u.employee_id ?? '—'}</td>
                  <td>{u.job_title ?? '—'}</td>
                  <td>
                    <span className={`badge ${statusColor[u.account_status ?? 'Active'] ?? 'badge-gray'}`}>
                      {u.account_status ?? 'Active'}
                    </span>
                  </td>
                  <td>{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn btn-sm btn-outline" onClick={() => resetPassword(u)}>Reset Pwd</button>
                      <button
                        className={`btn btn-sm ${u.account_status === 'Active' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleStatus(u)}
                      >
                        {u.account_status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u)}>Delete</button>
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

function InviteForm({ depts, onSave }: { depts: DeptRow[]; onSave: (d: Record<string, string>) => void }) {
  const [form, setForm] = useState({ email: '', full_name: '', role: 'nurse', employee_id: '', job_title: '', dept_id: '' })
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await onSave(form)
    setLoading(false)
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <div className="invite-notice">
        A password setup email will be sent to the user after their account is created.
      </div>
      <div className="form-row">
        <div className="form-group"><label>Full Name</label><input value={form.full_name} onChange={e => set('full_name', e.target.value)} required /></div>
        <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Role</label>
          <select value={form.role} onChange={e => set('role', e.target.value)}>
            {['superadmin', 'admin', 'educator', 'supervisor', 'nurse', 'director', 'it'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Department</label>
          <select value={form.dept_id} onChange={e => set('dept_id', e.target.value)}>
            <option value="">— None —</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Employee ID</label><input value={form.employee_id} onChange={e => set('employee_id', e.target.value)} /></div>
        <div className="form-group"><label>Job Title</label><input value={form.job_title} onChange={e => set('job_title', e.target.value)} /></div>
      </div>
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Sending Invite…' : 'Send Invitation'}</button>
      </div>
    </form>
  )
}

function UserEditForm({ initial, depts, onSave }: { initial: UserRow; depts: DeptRow[]; onSave: (d: Partial<UserRow>) => void }) {
  const [form, setForm] = useState({ ...initial })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-row">
        <div className="form-group"><label>Full Name</label><input value={form.full_name} onChange={e => set('full_name', e.target.value)} required /></div>
        <div className="form-group"><label>Email</label><input type="email" value={form.email} disabled style={{ opacity: 0.6 }} /></div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Role</label>
          <select value={form.role} onChange={e => set('role', e.target.value)}>
            {['superadmin', 'admin', 'educator', 'supervisor', 'nurse', 'director', 'it'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Department</label>
          <select value={form.dept_id ?? ''} onChange={e => set('dept_id', e.target.value)}>
            <option value="">— None —</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Employee ID</label><input value={form.employee_id ?? ''} onChange={e => set('employee_id', e.target.value)} /></div>
        <div className="form-group"><label>Job Title</label><input value={form.job_title ?? ''} onChange={e => set('job_title', e.target.value)} /></div>
      </div>
      <div className="form-group">
        <label>Account Status</label>
        <select value={form.account_status ?? 'Active'} onChange={e => set('account_status', e.target.value)}>
          <option>Active</option><option>Inactive</option><option>Suspended</option>
        </select>
      </div>
      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary">Save Changes</button>
      </div>
    </form>
  )
}
