import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Trash2, User } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authService } from '../services/authService.js';
import { formatDateTime } from '../utils/formatting.js';

export default function AccountSettings({ onAccountDeleted }) {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [profileStatus, setProfileStatus] = useState({ type: '', text: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({ type: '', text: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileStatus({ type: '', text: '' });
    if (name.trim().length < 2) {
      setProfileStatus({ type: 'error', text: 'Full name must be at least 2 characters.' });
      return;
    }

    setSavingProfile(true);
    try {
      const data = await authService.updateProfile({ name: name.trim() });
      setUser(data.user);
      setProfileStatus({ type: 'success', text: 'Profile name updated successfully.' });
    } catch (err) {
      setProfileStatus({ type: 'error', text: err.message || 'Unable to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', text: '' });

    if (!currentPassword) {
      setPasswordStatus({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordStatus({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      await authService.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordStatus({
        type: 'success',
        text: 'Password updated. Any other active sessions have been signed out.',
      });
    } catch (err) {
      setPasswordStatus({ type: 'error', text: err.message || 'Unable to change password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type DELETE in all caps to confirm account deletion.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm deletion.');
      return;
    }

    setDeleting(true);
    try {
      await authService.deleteAccount({
        password: deletePassword,
        confirmText: 'DELETE',
      });
      if (onAccountDeleted) onAccountDeleted();
      await logout().catch(() => {});
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <DashboardCard
        title="Account Details & Profile"
        subtitle="View your registered details or update your display name."
      >
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
          <div>
            <div className="text-slate-500">Email Address</div>
            <div className="mt-1 font-mono font-semibold text-slate-900">{user?.email}</div>
          </div>
          <div>
            <div className="text-slate-500">Account Created</div>
            <div className="mt-1 font-medium text-slate-900">{formatDateTime(user?.createdAt)}</div>
          </div>
          <div>
            <div className="text-slate-500">Last Updated</div>
            <div className="mt-1 font-medium text-slate-900">{formatDateTime(user?.updatedAt)}</div>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4 max-w-md">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Full Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              required
            />
          </label>

          {profileStatus.text && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${
                profileStatus.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {profileStatus.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{profileStatus.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400"
          >
            <User className="h-4 w-4" />
            {savingProfile ? 'Saving...' : 'Save Name'}
          </button>
        </form>
      </DashboardCard>

      <DashboardCard
        title="Change Password"
        subtitle="Verify your current password and choose a strong new password (8+ chars, upper/lowercase, number, and symbol)."
      >
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Current Password</span>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">New Password</span>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">Confirm New Password</span>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              required
            />
          </label>

          <button
            type="button"
            onClick={() => setShowPasswords((p) => !p)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>

          {passwordStatus.text && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${
                passwordStatus.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {passwordStatus.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{passwordStatus.text}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
            >
              <KeyRound className="h-4 w-4" />
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </DashboardCard>

      <DashboardCard
        title="Delete Account"
        subtitle="Permanently remove your DermaSense AI account and all associated saved data."
      >
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 leading-relaxed">
          <div className="font-semibold">What will be permanently deleted:</div>
          <ul className="mt-1.5 list-disc pl-5 space-y-1">
            <li>Your user profile (name, email, and credentials)</li>
            <li>All active login sessions across your devices</li>
            <li>All saved screening history records linked to your account</li>
          </ul>
          <p className="mt-2 font-medium">This action cannot be undone.</p>
        </div>

        <form onSubmit={handleDeleteAccount} className="space-y-4 max-w-md">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </span>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-700">Current Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter password to confirm"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              required
            />
          </label>

          {deleteError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:bg-slate-400"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting Account...' : 'Permanently Delete Account'}
          </button>
        </form>
      </DashboardCard>
    </div>
  );
}
