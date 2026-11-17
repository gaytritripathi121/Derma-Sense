import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Menu, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ROUTE_TITLES = {
  '/': 'Screening Workbench',
  '/analyze': 'Lesion Upload & Intake',
  '/results': 'Screening Output',
  '/explainability': 'Grad-CAM Inspection',
  '/safe-corner': 'Safe Corner Companion',
  '/history': 'Session Screening Log',
  '/performance': 'Model Overview & Screening Process',
  '/model-info': 'Model Overview & Screening Process',
  '/diseases': 'Skin Condition Reference',
  '/about': 'Methodology & Safety',
  '/login': 'Sign In',
  '/register': 'Create Account',
  '/dashboard': 'Account Dashboard',
  '/settings': 'Account Settings',
};

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function Navbar({ onOpenSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const pageTitle = ROUTE_TITLES[location.pathname] || 'DermaSense AI';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-sm font-semibold text-slate-900 truncate whitespace-nowrap">
          {pageTitle}
        </div>
      </div>

      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
        <Link to="/analyze" className="hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0">
          Analyze
        </Link>
        <Link to="/safe-corner" className="hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0">
          Safe Corner
        </Link>
        <Link to="/performance" className="hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0">
          Model Overview
        </Link>
        <Link to="/diseases" className="hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0">
          Diseases
        </Link>
      </nav>

      <div className="flex items-center gap-3 shrink-0">
        {!authLoading &&
          (user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                  {getInitials(user.name)}
                </span>
                <span className="hidden sm:inline max-w-[120px] truncate">{user.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-50"
                >
                  <div className="border-b border-slate-100 px-3.5 py-2">
                    <div className="text-xs font-semibold text-slate-900 truncate">{user.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">{user.email}</div>
                  </div>
                  <Link
                    to="/dashboard"
                    role="menuitem"
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Dashboard
                  </Link>
                  <Link
                    to="/settings"
                    role="menuitem"
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Account Settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3.5 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 whitespace-nowrap"
              >
                Sign Up
              </Link>
            </div>
          ))}

        <Link
          to="/analyze"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          New Screening
        </Link>
      </div>
    </header>
  );
}
