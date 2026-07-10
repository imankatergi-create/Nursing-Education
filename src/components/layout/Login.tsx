import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types'

const DEMO_USERS = [
  { label: 'Super Admin', email: 's.haddad@hospital.org', color: '#e74c3c' },
  { label: 'Admin', email: 'f.nassar@hospital.org', color: '#e67e22' },
  { label: 'Educator', email: 'l.khoury@hospital.org', color: '#27ae60' },
  { label: 'Supervisor', email: 'h.mansour@hospital.org', color: '#2980b9' },
  { label: 'Nurse', email: 'r.khalil@hospital.org', color: '#8e44ad' },
  { label: 'Director', email: 'm.arnaout@hospital.org', color: '#16a085' },
  { label: 'IT Admin', email: 'o.sleiman@hospital.org', color: '#c0392b' },
]

type LoginTab = 'signin' | 'forgot'

export default function Login({ onLogin }: { onLogin: (p: Profile) => void }) {
  const [tab, setTab] = useState<LoginTab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr || !data.user) {
      setError(authErr?.message ?? 'Login failed')
      setLoading(false)
      return
    }
    await supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
    if (prof) onLogin(prof)
    else setError('Profile not found. Please contact IT.')
    setLoading(false)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('Enter your email address'); return }
    setError('')
    setLoading(true)
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=1`,
    })
    if (resetErr) setError(resetErr.message)
    else setForgotSent(true)
    setLoading(false)
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('Demo1234!')
    setError('')
    setTab('signin')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">SDP</div>
          <h1>Staff Development Program</h1>
          <p>Hospital Training &amp; Education System</p>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab${tab === 'signin' ? ' active' : ''}`}
            onClick={() => { setTab('signin'); setError(''); setForgotSent(false) }}
          >
            Sign In
          </button>
          <button
            className={`login-tab${tab === 'forgot' ? ' active' : ''}`}
            onClick={() => { setTab('forgot'); setError(''); setForgotSent(false) }}
          >
            Forgot Password
          </button>
        </div>

        {tab === 'signin' ? (
          <form onSubmit={handleSignIn} className="login-form">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.email@hospital.org"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <div className="login-form">
            {forgotSent ? (
              <div className="login-success">
                <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>✅</div>
                <p style={{ textAlign: 'center' }}><strong>Reset link sent!</strong></p>
                <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: 14 }}>
                  Check your email at <strong>{email}</strong> for a password reset link.
                </p>
                <button
                  className="btn btn-outline btn-full"
                  style={{ marginTop: 12 }}
                  onClick={() => { setTab('signin'); setForgotSent(false) }}
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <p style={{ color: 'var(--text-light)', fontSize: 14, marginBottom: 16 }}>
                  Enter your email and we'll send you a password reset link.
                </p>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your.email@hospital.org"
                    required
                  />
                </div>
                {error && <div className="login-error">{error}</div>}
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-full"
                  style={{ marginTop: 8 }}
                  onClick={() => setTab('signin')}
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        )}

        <div className="login-demo">
          <p className="demo-label">Demo Accounts (password: Demo1234!)</p>
          <div className="demo-chips">
            {DEMO_USERS.map(u => (
              <button
                key={u.email}
                className="demo-chip"
                style={{ '--chip-color': u.color } as React.CSSProperties}
                onClick={() => fillDemo(u.email)}
                type="button"
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
