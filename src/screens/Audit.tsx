import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AUDIT_LOGS } from '../data/constants'
import type { AuditLog } from '../types'

export default function AuditScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200)
      if (data && data.length > 0) setLogs(data)
      else setLogs(AUDIT_LOGS)
      setLoading(false)
    })()
  }, [])

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    return !q || l.user_name.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.affected_record.toLowerCase().includes(q)
  })

  const actionColor: Record<string, string> = {
    CREATE: 'badge-green', UPDATE: 'badge-blue', DELETE: 'badge-red', LOGIN: 'badge-teal',
    LOGOUT: 'badge-gray', EXPORT: 'badge-amber', ASSIGN: 'badge-purple',
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Audit Log</h1>
          <p className="screen-subtitle">System activity trail</p>
        </div>
      </div>

      <div className="table-toolbar">
        <input className="search-input" placeholder="Search by user, action, record…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Record</th><th>IP Address</th><th>Before</th><th>After</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-loading">Loading…</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id}>
                  <td className="mono">{new Date(l.timestamp).toLocaleString()}</td>
                  <td>{l.user_name}</td>
                  <td><span className={`badge ${actionColor[l.action] ?? 'badge-gray'}`}>{l.action}</span></td>
                  <td>{l.affected_record}</td>
                  <td className="mono">{l.ip_address}</td>
                  <td className="audit-value">{l.before_value ?? '—'}</td>
                  <td className="audit-value">{l.after_value ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
