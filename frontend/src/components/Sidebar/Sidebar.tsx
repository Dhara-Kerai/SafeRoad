// Primary navigation groups, ready for route links and role-based access later.
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiActivity,
  FiBarChart2,
  FiBell,
  FiClipboard,
  FiFileText,
  FiGrid,
  FiHelpCircle,
  FiMap,
  FiSettings,
  FiShield,
  FiTool,
  FiUsers,
} from 'react-icons/fi';

import './Sidebar.css';

const navigationItems = [
  { label: 'Dashboard', icon: FiGrid, path: '/dashboard' },
  { label: 'Live Map', icon: FiMap, path: '/live-map' },
  { label: 'Pothole Reports', icon: FiClipboard, path: '/my-reports' },

  {
    label: 'AI Detection',
    icon: FiActivity,
    path: '/ai-detection',
    roles: ['citizen', 'municipal_officer', 'admin'],
  },

  {
    label: 'Officer Dashboard',
    icon: FiUsers,
    path: '/officer-dashboard',
    roles: ['municipal_officer', 'admin'],
  },

  {
    label: 'Repair Requests',
    icon: FiTool,
    path: '/my-reports',
    roles: ['municipal_officer', 'admin'],
  },

  {
    label: 'Analytics',
    icon: FiBarChart2,
    path: '/analytics',
    roles: ['citizen', 'municipal_officer', 'admin'],
  },

  {
    label: 'Admin Portal',
    icon: FiShield,
    path: '/admin',
    roles: ['admin'],
  },

  {
    label: 'Notifications',
    icon: FiBell,
    path: '/notifications',
    roles: ['citizen', 'municipal_officer', 'admin'],
  },

  {
    label: 'Documents',
    icon: FiFileText,
    path: '#',
    roles: ['admin'],
  },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const userRole = currentUser?.role || 'citizen';
  const handleNavigation = (path: string) => {
    if (path && path !== '#') {
      navigate(path);
    }
  };

  const isItemActive = (path: string) => {
    if (path === '#' || !path) {
      return false;
    }
    if (path === '/my-reports') {
      return location.pathname === '/my-reports' || location.pathname.startsWith('/report/');
    }
    if (path === '/ai-detection') {
      return location.pathname === '/ai-detection';
    }
    return location.pathname === path;
  };

  return (
    <aside className="sidebar">
      <nav aria-label="Primary">
        <p className="sidebar__label">WORKSPACE</p>

        {navigationItems
              .filter(
                (item) =>
                  !item.roles ||
                  item.roles.includes(userRole)
              )
        .map(({ label, icon: Icon, path }) => (
          <button
            type="button"
            key={label}
            className={`sidebar__item ${isItemActive(path) ? 'sidebar__item--active' : ''}`}
            onClick={() => {
              handleNavigation(path);
            }}
          >
            <Icon />
            {label}
          </button>
        ))}

        <p className="sidebar__label sidebar__label--secondary">ACCOUNT</p>
        <button type="button" className="sidebar__item">
          <FiSettings />
          Settings
        </button>
        <button type="button" className="sidebar__item">
          <FiHelpCircle />
          Support
        </button>
      </nav>

      <div className="sidebar__help">
        <FiShield />
        <strong>SafeRoad Support</strong>
        <span>Need help with a report?</span>
        <button type="button">Open Help Center</button>
      </div>
    </aside>
  );
};
