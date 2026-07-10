import { useApp } from '../../context/AppContext'
import { CERTS } from '../../data/constants'

export default function NurseCerts() {
  const { profile } = useApp()

  const statusColor: Record<string, string> = { valid: 'badge-green', expired: 'badge-red', revoked: 'badge-gray' }

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">My Certificates</h1>
          <p className="screen-subtitle">{CERTS.length} certificates earned</p>
        </div>
      </div>

      <div className="certs-grid">
        {CERTS.map(cert => (
          <div key={cert.id} className={`nurse-cert-card ${cert.status}`}>
            <div className="nurse-cert-header">
              <div className="nurse-cert-logo">🏥</div>
              <div className="nurse-cert-badge">
                <span className={`badge ${statusColor[cert.status]}`}>{cert.status}</span>
              </div>
            </div>
            <div className="nurse-cert-body">
              <div className="nurse-cert-title">Certificate of Completion</div>
              <div className="nurse-cert-course">{cert.course_name}</div>
              <div className="nurse-cert-recipient">{profile?.full_name ?? 'Nurse'}</div>
            </div>
            <div className="nurse-cert-details">
              <div className="cert-detail-row"><span>Certificate No.</span><span className="cert-mono">{cert.cert_no}</span></div>
              <div className="cert-detail-row"><span>Score</span><span><strong>{cert.score_pct}</strong></span></div>
              <div className="cert-detail-row"><span>Issued</span><span>{cert.issued_at}</span></div>
              <div className="cert-detail-row"><span>Expires</span><span style={{ color: cert.status === 'expired' ? 'var(--red)' : undefined }}>{cert.expiry_date}</span></div>
            </div>
            <div className="nurse-cert-footer">
              <div className="cert-verify">Verify: {cert.verify_code}</div>
              <button className="btn btn-sm" onClick={() => window.print()}>🖨 Print</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
