import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

interface CertRow {
  id: string; cert_no: string; profile_id: string; course_name: string; course_id?: string
  program_id?: string; program_name?: string
  issued_at: string; score_pct: string; expiry_date?: string; status: string
  verify_code: string; issued_by?: string; profile?: { full_name: string; email: string }
}

export default function CertificatesScreen() {
  const { toast, openModal, closeModal } = useApp()
  const [certs, setCerts] = useState<CertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'course' | 'program'>('all')

  useEffect(() => { fetchCerts() }, [])

  async function fetchCerts() {
    setLoading(true)
    const { data } = await supabase
      .from('certificates')
      .select('*, profile:profiles(full_name,email)')
      .order('issued_at', { ascending: false })
    setCerts((data as CertRow[]) ?? [])
    setLoading(false)
  }

  async function revokeCert(cert: CertRow) {
    if (!confirm(`Revoke certificate ${cert.cert_no}?`)) return
    await supabase.from('certificates').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', cert.id)
    await supabase.from('audit_logs').insert({
      user_name: 'Admin', action: 'REVOKE_CERTIFICATE',
      affected_record: `${cert.cert_no} — ${cert.course_name}`,
      ip_address: '—',
    })
    fetchCerts()
    toast(`Certificate ${cert.cert_no} revoked`)
  }

  async function issueCert(cert: CertRow) {
    await supabase.from('certificates').update({ status: 'Valid' }).eq('id', cert.id)
    fetchCerts()
    toast('Certificate reinstated')
  }

  const filtered = certs.filter(c => {
    const q = search.toLowerCase()
    const nurseName = (c.profile as { full_name: string } | null)?.full_name ?? ''
    const matchQ = !q || c.cert_no.toLowerCase().includes(q) || c.course_name?.toLowerCase().includes(q) || nurseName.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || c.status.toLowerCase() === statusFilter
    const matchType = typeFilter === 'all' || (typeFilter === 'program' ? Boolean(c.program_id) : !c.program_id)
    return matchQ && matchStatus && matchType
  })

  const statusColor: Record<string, string> = { Valid: 'badge-green', valid: 'badge-green', Expired: 'badge-red', expired: 'badge-red', revoked: 'badge-gray', Revoked: 'badge-gray' }

  const programCount = certs.filter(c => c.program_id).length
  const courseCount = certs.filter(c => !c.program_id).length

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Certificates</h1>
          <p className="screen-subtitle">{certs.length} certificates issued · {programCount} program · {courseCount} course</p>
        </div>
      </div>

      <div className="tab-row">
        <button className={`tab-btn${typeFilter === 'all' ? ' active' : ''}`} onClick={() => setTypeFilter('all')}>
          All <span className="tab-count">{certs.length}</span>
        </button>
        <button className={`tab-btn${typeFilter === 'course' ? ' active' : ''}`} onClick={() => setTypeFilter('course')}>
          Course Certs <span className="tab-count">{courseCount}</span>
        </button>
        <button className={`tab-btn${typeFilter === 'program' ? ' active' : ''}`} onClick={() => setTypeFilter('program')}>
          Program Certs <span className="tab-count">{programCount}</span>
        </button>
      </div>

      <div className="table-toolbar">
        <input className="search-input" placeholder="Search by cert no., course, or nurse…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="valid">Valid</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cert No.</th><th>Nurse</th><th>Type</th><th>Name</th><th>Issued</th>
                <th>Score</th><th>Expiry</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-loading">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">No certificates found</td></tr>
              ) : filtered.map(c => {
                const nurse = c.profile as { full_name: string } | null
                const isProgramCert = Boolean(c.program_id)
                return (
                  <tr key={c.id}>
                    <td><span className="cert-no">{c.cert_no}</span></td>
                    <td>{nurse?.full_name ?? '—'}</td>
                    <td>
                      {isProgramCert
                        ? <span className="badge badge-purple">Program</span>
                        : <span className="badge badge-teal">Course</span>}
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{c.course_name || c.program_name || '—'}</div>
                      {isProgramCert && c.program_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Program Certificate</div>}
                    </td>
                    <td>{c.issued_at ? new Date(c.issued_at).toLocaleDateString() : '—'}</td>
                    <td>{c.score_pct || '—'}</td>
                    <td>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '—'}</td>
                    <td><span className={`badge ${statusColor[c.status] ?? 'badge-gray'}`}>{c.status}</span></td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="btn btn-sm"
                          onClick={() => openModal({ title: 'Certificate', wide: true, body: <CertView cert={c} nurseName={nurse?.full_name} onClose={closeModal} /> })}
                        >
                          View
                        </button>
                        {c.status.toLowerCase() !== 'revoked' ? (
                          <button className="btn btn-sm btn-danger" onClick={() => revokeCert(c)}>Revoke</button>
                        ) : (
                          <button className="btn btn-sm btn-success" onClick={() => issueCert(c)}>Reinstate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CertView({ cert, nurseName, onClose }: { cert: CertRow; nurseName?: string; onClose: () => void }) {
  const isProgramCert = Boolean(cert.program_id)
  return (
    <div>
      <div className="cert-preview" id="cert-print">
        <div className="cert-preview-header">
          <div className="cert-preview-logo">🏥 Hospital Staff Development Program</div>
          <div className="cert-preview-title">Certificate of {isProgramCert ? 'Program Completion' : 'Completion'}</div>
        </div>
        <div className="cert-preview-body">
          <p>This certifies that</p>
          <div className="cert-preview-name">{nurseName ?? 'Staff Member'}</div>
          <p>has successfully completed {isProgramCert ? 'the training program' : 'the course'}</p>
          <div className="cert-preview-course">{cert.course_name || cert.program_name}</div>
          <div className="cert-preview-details">
            <span>Score: <strong>{cert.score_pct || 'N/A'}</strong></span>
            <span>Issued: <strong>{cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : '—'}</strong></span>
            {cert.expiry_date && <span>Expires: <strong>{new Date(cert.expiry_date).toLocaleDateString()}</strong></span>}
          </div>
        </div>
        <div className="cert-preview-footer">
          <div className="cert-no-display">Certificate No: {cert.cert_no}</div>
          <div className="cert-verify">Verify Code: {cert.verify_code}</div>
          {cert.status.toLowerCase() === 'revoked' && <div className="cert-revoked-stamp">REVOKED</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print</button>
        <button className="btn btn-outline" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
