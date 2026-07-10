import { useApp } from '../../context/AppContext'
import { permissionsToScreens } from '../../App'
import type { Screen } from '../../types'

interface NavItem { icon: string; label: string; screen: Screen }

const CMS_NAV: NavItem[] = [
  { icon: '⊞', label: 'Dashboard', screen: 'dashboard' },
  { icon: '👥', label: 'Users', screen: 'users' },
  { icon: '🔑', label: 'Roles', screen: 'roles' },
  { icon: '🏢', label: 'Departments', screen: 'depts' },
  { icon: '📋', label: 'Programs', screen: 'programs' },
  { icon: '📚', label: 'Courses', screen: 'courses' },
  { icon: '📝', label: 'Syllabus', screen: 'syllabus' },
  { icon: '📎', label: 'Materials', screen: 'materials' },
  { icon: '📊', label: 'Quizzes', screen: 'quizzes' },
  { icon: '✅', label: 'Assignments', screen: 'assignments' },
  { icon: '📈', label: 'Progress', screen: 'progress' },
  { icon: '📉', label: 'Reports', screen: 'reports' },
  { icon: '🔔', label: 'Notifications', screen: 'notifications' },
  { icon: '📣', label: 'Announcements', screen: 'announcements' },
  { icon: '🎓', label: 'Certificates', screen: 'certificates' },
  { icon: '💬', label: 'Feedback', screen: 'feedback' },
  { icon: '🗒️', label: 'Audit Log', screen: 'audit' },
  { icon: '⚙️', label: 'Settings', screen: 'settings' },
  { icon: '🗺️', label: 'Coverage Map', screen: 'coverage' },
]

const NURSE_NAV: NavItem[] = [
  { icon: '⊞', label: 'Dashboard', screen: 'ndash' },
  { icon: '📚', label: 'My Courses', screen: 'ncourses' },
  { icon: '🎓', label: 'Certificates', screen: 'ncerts' },
  { icon: '🔔', label: 'Notifications', screen: 'nnotifs' },
  { icon: '🔍', label: 'Search', screen: 'nsearch' },
]

export default function Sidebar({ isNursePortal, open, onClose }: { isNursePortal: boolean; open: boolean; onClose: () => void }) {
  const { screen, navigate, profile, role, permissions } = useApp()

  const allowedScreens: Screen[] = permissions.length > 0
    ? permissionsToScreens(permissions)
    : []

  const navItems = (isNursePortal || role === 'nurse')
    ? NURSE_NAV
    : CMS_NAV.filter(n => allowedScreens.includes(n.screen))

  return (
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">SDP</div>
        <div className="brand-text">
          <div className="brand-name">Staff Dev</div>
          <div className="brand-sub">Program</div>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">✕</button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.screen}
            className={`nav-item${screen === item.screen ? ' active' : ''}`}
            onClick={() => navigate(item.screen)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {role !== 'nurse' && !isNursePortal && (
        <button className="nav-item nurse-switch" onClick={() => navigate('ndash')}>
          <span className="nav-icon">🔄</span>
          <span className="nav-label">Nurse View</span>
        </button>
      )}
      {role !== 'nurse' && isNursePortal && (
        <button className="nav-item nurse-switch" onClick={() => navigate('dashboard')}>
          <span className="nav-icon">🔄</span>
          <span className="nav-label">Admin View</span>
        </button>
      )}

      <div className="sidebar-user">
        <div className="sidebar-avatar">{profile?.full_name?.[0] ?? '?'}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{profile?.full_name}</div>
          <div className="sidebar-user-role">{role}</div>
        </div>
      </div>
    </aside>
  )
}
