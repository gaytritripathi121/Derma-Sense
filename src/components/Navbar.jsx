import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

const ROUTE_TITLES = {
  '/': 'Screening Workbench',
  '/analyze': 'Lesion Upload & Intake',
  '/results': 'Screening Output',
  '/explainability': 'Grad-CAM Inspection',
  '/safe-corner': 'Safe Corner Companion',
  '/history': 'Session Screening Log',
  '/performance': 'Clinical Model Validation',
  '/diseases': 'Skin Condition Reference',
  '/about': 'Methodology & Safety',
};

export default function Navbar({ onOpenSidebar }) {
  const location = useLocation();
  const pageTitle = ROUTE_TITLES[location.pathname] || 'DermaSense AI';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-8 border-b border-slate-200 bg-white px-6">
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
          Validation
        </Link>
        <Link to="/diseases" className="hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap shrink-0">
          Diseases
        </Link>
      </nav>

      <div className="flex items-center shrink-0">
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
