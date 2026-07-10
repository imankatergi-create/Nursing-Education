import { useApp } from '../../context/AppContext'
import type { Screen } from '../../types'

interface NavItem { icon: string; label: string; screen: Screen; permission?: string }

// Every CMS nav item declares which permission controls its visibility.
// Items with no permission are visible to all non-nurse roles.
const CMS_NAV: NavItem[] = [
  { icon: '⊞', label: 'Dashboard',     screen: 'dashboard',     permission: 'View Dashboard' },
  { icon: '👥', label: 'Users',         screen: 'users',         permission: 'Manage Users' },
  { icon: '🔑', label: 'Roles',         screen: 'roles',         permission: 'Manage Roles' },
  { icon: '🏢', label: 'Departments',   screen: 'depts',         permission: 'Manage Departments' },
  { icon: '📋', label: 'Programs',      screen: 'programs',      permission: 'Create Programs' },
  { icon: '📚', label: 'Courses',       screen: 'courses',       permission: 'Create Courses' },
  { icon: '📝', label: 'Syllabus',      screen: 'syllabus',      permission: 'Edit Courses' },
  { icon: '📎', label: 'Materials',     screen: 'materials',     permission: 'Upload Materials' },
  { icon: '📊', label: 'Quizzes',       screen: 'quizzes',       permission: 'Create Quizzes' },
  { icon: '✅', label: 'Assignments',   screen: 'assignments',   permission: 'View Reports' },
  { icon: '📈', label: 'Progress',      screen: 'progress',      permission: 'View Reports' },
  { icon: '📉', label: 'Reports',       screen: 'reports',       permission: 'View Reports' },
  { icon: '🔔', label: 'Notifications', screen: 'notifications', permission: 'Send Notifications' },
  { icon: '📣', label: 'Announcements', screen: 'announcements', permission: 'Create Announcements' },
  { icon: '🎓', label: 'Certificates',  screen: 'certificates',  permission: 'View Certificates' },
  { icon: '💬', label: 'Feedback',      screen: 'feedback',      permission: 'View Reports' },
  { icon: '🗒️', label: 'Audit Log',     screen: 'audit',         permission: 'View Audit Log' },
  { icon: '⚙️', label: 'Settings',      screen: 'settings',      permission: 'System Settings' },
  { icon: '🗺️', label: 'Coverage Map',  screen: 'coverage',      permission: 'View Reports' },
]

const NURSE_NAV: NavItem[] = [
  { icon: '⊞', label: 'Dashboard',      screen: 'ndash' },
  { icon: '📚', label: 'My Courses',     screen: 'ncourses' },
  { icon: '🎓', label: 'Certificates',   screen: 'ncerts' },
  { icon: '🔔', label: 'Notifications',  screen: 'nnotifs' },
  { icon: '🔍', label: 'Search',         screen: 'nsearch' },
]

// Superadmin always gets everything regardless of stored permissions.

export default function Sidebar({ isNursePortal, open, onClose }: { isNursePortal: boolean; open: boolean; onClose: () => void }) {
  const { screen, navigate, profile, role, permissions } = useApp()

  let navItems: NavItem[]

  if (isNursePortal || role === 'nurse') {
    navItems = NURSE_NAV
  } else if (role === 'superadmin') {
    navItems = CMS_NAV
  } else {
    // Show an item if the user's role has the matching permission in custom_roles.
    navItems = CMS_NAV.filter(item =>
      !item.permission || permissions.includes(item.permission)
    )
  }

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
