import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types'

export default function ForceChangePassword({ profile, onDone }: { profile: Profile; onDone: (p: Profile) => void }) {
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPwd.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPwd !== confirmPwd) { setError('Passwords do not match'); return }

    setLoading(true)
    const { data, error: fnErr } = await supabase.functions.invoke('admin-users', {
      body: { action: 'change_password', user_id: profile.id, new_password: newPwd },
    })
    if (fnErr || data?.error) {
      setError(data?.error ?? fnErr?.message ?? 'Failed to change password')
      setLoading(false)
      return
    }

    // Re-sign in with new password so the session stays valid
    await supabase.auth.signInWithPassword({ email: profile.email, password: newPwd })

    onDone({ ...profile, must_change_password: false })
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo" style={{ background: 'var(--amber)' }}>🔐</div>
          <h1>Set Your Password</h1>
          <p>Your account requires a new password before continuing.</p>
        </div>

        <div style={{ background: 'var(--amber-t)', border: '1px solid var(--amber)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--amber)' }}>
          This is your first login. Please choose a secure password to protect your account.
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Repeat your new password"
              required
            />
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 4 }}>
            <span style={{ color: newPwd.length >= 8 ? 'var(--green)' : 'var(--muted)' }}>
              {newPwd.length >= 8 ? '✓' : '○'} At least 8 characters
            </span>
            <span style={{ color: newPwd && confirmPwd && newPwd === confirmPwd ? 'var(--green)' : 'var(--muted)' }}>
              {newPwd && confirmPwd && newPwd === confirmPwd ? '✓' : '○'} Passwords match
            </span>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || newPwd.length < 8 || newPwd !== confirmPwd}
          >
            {loading ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>
          Signed in as <strong>{profile.email}</strong>
        </p>
      </div>
    </div>
  )
}
