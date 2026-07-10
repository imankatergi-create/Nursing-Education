import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

interface CertRow {
  id: string
  cert_no: string
  course_name: string
  issued_at: string
  score_pct: string
  expiry_date: string
  status: string
  verify_code: string
  issued_by: string
}

const STATUS_COLOR: Record<string, string> = { Valid: 'badge-green', Expired: 'badge-red', Revoked: 'badge-gray' }

export default function NurseCerts() {
  const { profile } = useApp()
  const [certs, setCerts] = useState<CertRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('certificates')
      .select('*')
      .eq('profile_id', profile.id)
      .order('issued_at', { ascending: false })
      .then(({ data }) => {
        setCerts(data ?? [])
        setLoading(false)
      })
  }, [profile?.id])

  if (loading) {
    return (
      <div className="screen-container">
        <div className="loading-state">Loading certificates…</div>
      </div>
    )
  }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">My Certificates</h1>
          <p className="screen-subtitle">
            {certs.length === 0 ? 'No certificates yet' : `${certs.length} certificate${certs.length !== 1 ? 's' : ''} earned`}
          </p>
        </div>
      </div>

      {certs.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No certificates yet</div>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            Complete all lessons in a course to earn your certificate.
          </div>
        </div>
      ) : (
        <div className="certs-grid">
          {certs.map(cert => (
            <div key={cert.id} className={`nurse-cert-card ${cert.status?.toLowerCase()}`}>
              <div className="nurse-cert-header">
                <div className="nurse-cert-logo">🏥</div>
                <div className="nurse-cert-badge">
                  <span className={`badge ${STATUS_COLOR[cert.status] ?? 'badge-gray'}`}>{cert.status}</span>
                </div>
              </div>
              <div className="nurse-cert-body">
                <div className="nurse-cert-title">Certificate of Completion</div>
                <div className="nurse-cert-course">{cert.course_name}</div>
                <div className="nurse-cert-recipient">{profile?.full_name ?? ''}</div>
              </div>
              <div className="nurse-cert-details">
                <div className="cert-detail-row">
                  <span>Certificate No.</span>
                  <span className="cert-mono">{cert.cert_no}</span>
                </div>
                <div className="cert-detail-row">
                  <span>Score</span>
                  <strong>{cert.score_pct}</strong>
                </div>
                <div className="cert-detail-row">
                  <span>Issued</span>
                  <span>{cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : '—'}</span>
                </div>
                <div className="cert-detail-row">
                  <span>Expires</span>
                  <span style={{ color: cert.status === 'Expired' ? 'var(--red)' : undefined }}>
                    {cert.expiry_date ?? '—'}
                  </span>
                </div>
                <div className="cert-detail-row">
                  <span>Issued By</span>
                  <span>{cert.issued_by}</span>
                </div>
              </div>
              <div className="nurse-cert-footer">
                <div className="cert-verify">Verify: {cert.verify_code}</div>
                <button className="btn btn-sm" onClick={() => window.print()}>Print</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
