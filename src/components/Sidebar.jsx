import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Cpu,
  Eye,
  FileSearch,
  HeartHandshake,
  History,
  Home,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_GROUPS = [
  {
    label: 'Clinical Screening',
    items: [
      { to: '/', label: 'Overview', icon: Home },
      { to: '/analyze', label: 'Analyze Lesion', icon: FileSearch },
      { to: '/results', label: 'Screening Results', icon: Activity },
      { to: '/explainability', label: 'Grad-CAM Lab', icon: Eye },
      { to: '/safe-corner', label: 'Safe Corner', icon: HeartHandshake },
      { to: '/history', label: 'Session History', icon: History },
    ],
  },
  {
    label: 'Reference & Guide',
    items: [
      { to: '/performance', label: 'Model Overview', icon: Cpu },
      { to: '/diseases', label: 'Disease Guide', icon: BookOpen },
      { to: '/about', label: 'About & Safety', icon: Info },
    ],
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <NavLink
            to="/"
            onClick={onClose}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            DermaSense AI
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6" aria-label="Primary Navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 pb-2 text-xs font-semibold text-slate-400">
                {group.label}
              </div>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {!authLoading && (
            <div>
              <div className="px-3 pb-2 text-xs font-semibold text-slate-400">Account</div>
              {user ? (
                <ul className="space-y-1">
                  <li>
                    <NavLink
                      to="/dashboard"
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <LayoutDashboard className="h-4 w-4 shrink-0" />
                      <span className="truncate">Dashboard</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/settings"
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <Settings className="h-4 w-4 shrink-0" />
                      <span className="truncate">Account Settings</span>
                    </NavLink>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors whitespace-nowrap"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span className="truncate">Log Out</span>
                    </button>
                  </li>
                </ul>
              ) : (
                <ul className="space-y-1">
                  <li>
                    <NavLink
                      to="/login"
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <LogIn className="h-4 w-4 shrink-0" />
                      <span className="truncate">Log In</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/register"
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <UserPlus className="h-4 w-4 shrink-0" />
                      <span className="truncate">Sign Up</span>
                    </NavLink>
                  </li>
                </ul>
              )}
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500 leading-relaxed">
          Academic skin screening prototype. Not a medical diagnosis tool.
        </div>
      </aside>
    </>
  );
}
