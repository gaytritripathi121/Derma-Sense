import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Info, LogIn } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, databaseConnected, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!authLoading && user) {
    const dest = location.state?.from || '/dashboard';
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: cleanEmail, password, rememberMe });
      const dest = location.state?.from || '/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      {!authLoading && !databaseConnected && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-xs text-amber-950 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <div className="font-semibold">Account Database Not Configured</div>
              <p className="mt-1 text-amber-900">
                MongoDB Atlas is not connected on this server yet, so account sign-in is unavailable. You can still use all skin screening, Grad-CAM, and Safe Corner tools without logging in.
              </p>
              <Link
                to="/analyze"
                className="mt-2 inline-block font-semibold text-amber-950 underline"
              >
                Continue in Guest Mode
              </Link>
            </div>
          </div>
        </div>
      )}

      <DashboardCard
        title="Sign In to DermaSense AI"
        subtitle="Access your saved screening history and personalized dashboard. Guest screening remains available without an account."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Email Address</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">Password</span>
            <div className="relative mt-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Keep me signed in for 30 days on this device
          </label>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            New to DermaSense AI?{' '}
            <Link to="/register" className="font-semibold text-blue-700 hover:underline">
              Create an account
            </Link>
          </span>
          <Link to="/analyze" className="font-medium text-slate-700 hover:text-slate-900 underline">
            Continue as Guest
          </Link>
        </div>
      </DashboardCard>
    </div>
  );
}
