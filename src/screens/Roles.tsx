import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

const ALL_PERMISSIONS = [
  'View Dashboard', 'Manage Users', 'Manage Roles', 'Manage Departments',
  'Create Programs', 'Edit Programs', 'Create Courses', 'Edit Courses',
  'Upload Materials', 'Create Quizzes', 'View Reports', 'Export Reports',
  'Send Notifications', 'Create Announcements', 'View Certificates',
  'Issue Certificates', 'View Audit Log', 'System Settings',
]

interface RoleRow {
  id: string
  name: string
  description: string
  color: string
  permissions: string[]
}

export default function RolesScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchRoles() }, [])

  async function fetchRoles() {
    setLoading(true)
    const { data } = await supabase.from('custom_roles').select('*').order('id')
    if (data) setRoles(data.map(r => ({ ...r, permissions: Array.isArray(r.permissions) ? r.permissions : JSON.parse(r.permissions ?? '[]') })))
    setLoading(false)
  }

  async function saveRole(role: RoleRow) {
    await supabase.from('custom_roles').upsert({ ...role, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    fetchRoles()
    closeModal()
    toast('Role saved')
  }

  async function deleteRole(id: string) {
    const protected_ = ['superadmin', 'nurse']
    if (protected_.includes(id)) { toast('Cannot delete protected role'); return }
    await supabase.from('custom_roles').delete().eq('id', id)
    fetchRoles()
    toast('Role deleted')
  }

  function openCreate() {
    openModal({
      title: 'Create Role', wide: true,
      body: <RoleForm onSave={saveRole} />,
    })
  }

  function openEdit(role: RoleRow) {
    openModal({
      title: `Edit Role: ${role.name}`, wide: true,
      body: <RoleForm initial={role} onSave={saveRole} />,
    })
  }

  if (loading) return <div className="screen-container"><div className="loading-state">Loading roles…</div></div>

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Roles &amp; Permissions</h1>
          <p className="screen-subtitle">{roles.length} roles configured</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Role</button>
      </div>

      {/* Permission matrix */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3>Permission Matrix</h3></div>
        <div className="table-wrap">
          <table className="data-table permission-matrix">
            <thead>
              <tr>
                <th>Permission</th>
                {roles.map(r => (
                  <th key={r.id} className="text-center">
                    <span className="role-badge-sm" style={{ background: r.color }}>{r.id}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map(perm => (
                <tr key={perm}>
                  <td className="perm-name">{perm}</td>
                  {roles.map(r => (
                    <td key={r.id} className="text-center">
                      {r.permissions.includes(perm)
                        ? <span className="perm-check">✓</span>
                        : <span className="perm-x">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role cards */}
      <div className="roles-cards">
        {roles.map(r => (
          <div key={r.id} className="role-card">
            <div className="role-card-header">
              <span className="role-badge" style={{ background: r.color }}>{r.name}</span>
              <div className="role-card-actions">
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(r)}>Edit</button>
                {!['superadmin', 'nurse'].includes(r.id) && (
                  <button className="btn btn-sm btn-danger" onClick={() => deleteRole(r.id)}>Delete</button>
                )}
              </div>
            </div>
            <p className="role-desc">{r.description}</p>
            <div className="role-perms">
              {r.permissions.slice(0, 4).map(p => (
                <span key={p} className="role-perm-tag">{p}</span>
              ))}
              {r.permissions.length > 4 && (
                <span className="role-perm-more">+{r.permissions.length - 4} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoleForm({ initial, onSave }: { initial?: RoleRow; onSave: (r: RoleRow) => void }) {
  const [form, setForm] = useState<RoleRow>(initial ?? {
    id: '', name: '', description: '', color: '#6B7280', permissions: [],
  })

  function togglePerm(p: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter(x => x !== p)
        : [...f.permissions, p],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.id.trim() || !form.name.trim()) return
    onSave({ ...form, id: form.id.toLowerCase().replace(/\s+/g, '_') })
  }

  const isEdit = Boolean(initial)

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label>Role ID {isEdit && <span style={{ color: 'var(--muted)', fontSize: 11 }}>(cannot change)</span>}</label>
          <input
            value={form.id}
            onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
            placeholder="e.g. charge_nurse"
            required
            disabled={isEdit}
          />
        </div>
        <div className="form-group">
          <label>Display Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label>Color</label>
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ height: 40 }} />
        </div>
      </div>
      <div className="form-group">
        <label>Description</label>
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      <div className="form-section-title">Permissions</div>
      <div className="permissions-grid">
        {ALL_PERMISSIONS.map(p => (
          <label key={p} className="perm-checkbox">
            <input
              type="checkbox"
              checked={form.permissions.includes(p)}
              onChange={() => togglePerm(p)}
            />
            {p}
          </label>
        ))}
      </div>

      <div className="modal-form-actions">
        <button type="submit" className="btn btn-primary">Save Role</button>
      </div>
    </form>
  )
}
