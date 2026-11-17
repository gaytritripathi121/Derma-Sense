import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Eye, EyeOff, Info, UserPlus } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function evaluateStrength(password) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'One number', ok: /[0-9]/.test(password) },
    { label: 'One special character', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  let label = 'Too weak';
  let color = 'bg-rose-500';
  if (score >= 5) {
    label = 'Strong';
    color = 'bg-emerald-600';
  } else if (score === 4) {
    label = 'Good';
    color = 'bg-blue-600';
  } else if (score >= 2) {
    label = 'Fair';
    color = 'bg-amber-500';
  }
  return { checks, score, label, color };
}

export default function Register() {
  const navigate = useNavigate();
  const { user, loading: authLoading, databaseConnected, register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const strength = useMemo(() => evaluateStrength(password), [password]);

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (cleanName.length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (strength.score < 5) {
      setError(
        'Please meet all password strength requirements (8+ characters, uppercase, lowercase, number, and special character).'
      );
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: cleanName,
        email: cleanEmail,
        password,
        confirmPassword,
        rememberMe: false,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to create account.');
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
                MongoDB Atlas is not connected on this server yet, so account registration is temporarily unavailable. You can still run lesion screenings in Guest Mode.
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
        title="Create a Free DermaSense AI Account"
        subtitle="Save your screening summaries (without storing uploaded lesion photos) and manage your personal dashboard."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Full Name</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Morgan"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </label>

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

          <div>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Password</span>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
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

            {password.length > 0 && (
              <div className="mt-2.5 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Password strength</span>
                  <span className="font-semibold text-slate-900">{strength.label}</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 rounded-full ${
                        strength.score >= step ? strength.color : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-1 gap-1 pt-1 text-[11px] text-slate-600">
                  {strength.checks.map((c) => (
                    <li
                      key={c.label}
                      className={`flex items-center gap-1.5 ${
                        c.ok ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      <Check className={`h-3 w-3 ${c.ok ? 'opacity-100' : 'opacity-30'}`} />
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">Confirm Password</span>
            <div className="relative mt-1.5">
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
            <UserPlus className="h-4 w-4" />
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-blue-700 hover:underline">
              Sign in
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
