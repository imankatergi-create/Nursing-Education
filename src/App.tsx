import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { AppContext } from './context/AppContext'
import type { ModalConfig } from './context/AppContext'
import type { Profile, Screen } from './types'

import Login from './components/layout/Login'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'

import Dashboard from './screens/Dashboard'
import UsersScreen from './screens/Users'
import RolesScreen from './screens/Roles'
import DeptsScreen from './screens/Depts'
import ProgramsScreen from './screens/Programs'
import CoursesScreen from './screens/Courses'
import SyllabusScreen from './screens/Syllabus'
import MaterialsScreen from './screens/Materials'
import QuizzesScreen from './screens/Quizzes'
import AssignmentsScreen from './screens/Assignments'
import ProgressScreen from './screens/Progress'
import ReportsScreen from './screens/Reports'
import NotificationsScreen from './screens/Notifications'
import AnnouncementsScreen from './screens/Announcements'
import CertificatesScreen from './screens/Certificates'
import FeedbackScreen from './screens/Feedback'
import AuditScreen from './screens/Audit'
import SettingsScreen from './screens/Settings'
import CoverageScreen from './screens/Coverage'
import CmsSearchScreen from './screens/CmsSearch'

import NurseDash from './screens/nurse/NurseDash'
import NurseCourses from './screens/nurse/NurseCourses'
import NurseCourse from './screens/nurse/NurseCourse'
import NurseCerts from './screens/nurse/NurseCerts'
import NurseNotifs from './screens/nurse/NurseNotifs'
import NurseSearch from './screens/nurse/NurseSearch'

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [params, setParams] = useState<Record<string, string>>({})
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalConfig | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      ;(async () => {
        if (session?.user) await loadProfile(session.user.id)
        else { setProfile(null); setLoading(false) }
      })()
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data)
    if (data?.role === 'nurse') setScreen('ndash')
    setLoading(false)
  }

  const navigate = useCallback((s: Screen, p?: Record<string, string>) => {
    setScreen(s)
    setParams(p ?? {})
    setSidebarOpen(false)
  }, [])

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500)
  }, [])

  const openModal = useCallback((config: ModalConfig) => setModal(config), [])
  const closeModal = useCallback(() => setModal(null), [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div className="spinner" style={{ width:40, height:40, border:'4px solid var(--border)', borderTopColor:'var(--teal)', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ color:'var(--text-light)', fontSize:14 }}>Loading…</p>
      </div>
    </div>
  )

  // Handle password recovery link — show password reset form before login
  const urlParams = new URLSearchParams(window.location.search)
  if (!profile && urlParams.get('reset') === '1') {
    return <PasswordResetPage />
  }

  if (!profile) return <Login onLogin={setProfile} />

  const role = profile.role

  function renderScreen() {
    const nurseScreens: Screen[] = ['ndash','ncourses','ncourse','ncerts','nnotifs','nsearch']
    if (nurseScreens.includes(screen)) {
      switch (screen) {
        case 'ndash': return <NurseDash />
        case 'ncourses': return <NurseCourses />
        case 'ncourse': return <NurseCourse />
        case 'ncerts': return <NurseCerts />
        case 'nnotifs': return <NurseNotifs />
        case 'nsearch': return <NurseSearch />
        default: return <NurseDash />
      }
    }
    switch (screen) {
      case 'dashboard': return <Dashboard />
      case 'users': return <UsersScreen />
      case 'roles': return <RolesScreen />
      case 'depts': return <DeptsScreen />
      case 'programs': return <ProgramsScreen />
      case 'courses': return <CoursesScreen />
      case 'syllabus': return <SyllabusScreen />
      case 'materials': return <MaterialsScreen />
      case 'quizzes': return <QuizzesScreen />
      case 'assignments': return <AssignmentsScreen />
      case 'progress': return <ProgressScreen />
      case 'reports': return <ReportsScreen />
      case 'notifications': return <NotificationsScreen />
      case 'announcements': return <AnnouncementsScreen />
      case 'certificates': return <CertificatesScreen />
      case 'feedback': return <FeedbackScreen />
      case 'audit': return <AuditScreen />
      case 'settings': return <SettingsScreen />
      case 'coverage': return <CoverageScreen />
      case 'cmssearch': return <CmsSearchScreen />
      default: return <Dashboard />
    }
  }

  const isNursePortal = ['ndash','ncourses','ncourse','ncerts','nnotifs','nsearch'].includes(screen)

  return (
    <AppContext.Provider value={{ profile, role, navigate, screen, params, toast, openModal, closeModal }}>
      <div className="app-shell">
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <Sidebar isNursePortal={isNursePortal} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-area">
          <TopBar isNursePortal={isNursePortal} onBurger={() => setSidebarOpen(o => !o)} />
          <div className="content">
            {renderScreen()}
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className={`modal-box${modal.wide ? ' modal-wide' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.title}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">{modal.body}</div>
            {modal.footer && <div className="modal-footer">{modal.footer}</div>}
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="toast">{toastMsg}</div>
      )}
    </AppContext.Provider>
  )
}

function PasswordResetPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) { setError(updateErr.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
    // Clean up URL
    window.history.replaceState({}, '', '/')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">SDP</div>
          <h1>Set New Password</h1>
          <p>Staff Development Program</p>
        </div>
        {done ? (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
            <p><strong>Password updated!</strong></p>
            <p style={{ color:'var(--text-light)', fontSize:14, marginBottom:16 }}>
              Your password has been set. You can now sign in.
            </p>
            <a href="/" className="btn btn-primary btn-full">Go to Sign In</a>
          </div>
        ) : (
          <form onSubmit={handleReset} className="login-form">
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Saving…' : 'Set Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
