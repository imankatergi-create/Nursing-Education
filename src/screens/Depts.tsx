import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface DeptRow { id: string; name: string; supervisor?: string; active: boolean }

export default function DeptsScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [depts, setDepts] = useState<DeptRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDepts() }, [])

  async function fetchDepts() {
    setLoading(true)
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepts(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    openModal({
      title: 'Add Department',
      body: <DeptForm onSave={async d => { await supabase.from('departments').insert(d); fetchDepts(); closeModal(); toast('Department added') }} />,
    })
  }

  function openEdit(dept: DeptRow) {
    openModal({
      title: 'Edit Department',
      body: <DeptForm initial={dept} onSave={async d => { await supabase.from('departments').update(d).eq('id', dept.id); fetchDepts(); closeModal(); toast('Department updated') }} />,
    })
  }

  async function deleteDept(dept: DeptRow) {
    if (!confirm(`Delete department "${dept.name}"? This cannot be undone.`)) return
    await supabase.from('departments').delete().eq('id', dept.id)
    fetchDepts()
    toast('Department deleted')
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Departments</h1>
          <p className="screen-subtitle">{depts.length} departments configured</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Department</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Department</th><th>Supervisor</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="table-loading">Loading…</td></tr>
              ) : depts.map(d => (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.supervisor ?? '—'}</td>
                  <td><span className={`badge ${d.active ? 'badge-green' : 'badge-red'}`}>{d.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm" onClick={() => openEdit(d)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteDept(d)}>Delete</button>
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

function DeptForm({ initial, onSave }: { initial?: Partial<DeptRow>; onSave: (d: Partial<DeptRow>) => void }) {
  const [form, setForm] = useState({ name: '', supervisor: '', active: true, ...initial })
  return (
    <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <div className="form-group"><label>Department Name</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></div>
      <div className="form-group"><label>Supervisor</label><input value={form.supervisor} onChange={e => setForm(f => ({...f, supervisor: e.target.value}))} /></div>
      <div className="form-group checkbox-group">
        <label><input type="checkbox" checked={form.active} onChange={e => setForm(f => ({...f, active: e.target.checked}))} /> Active</label>
      </div>
      <div className="modal-form-actions"><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  )
}
