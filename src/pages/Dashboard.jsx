import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Calendar,
  Download,
  Eye,
  Settings,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authService } from '../services/authService.js';
import { predictionService } from '../services/predictionService.js';
import { reportService } from '../services/reportService.js';
import { formatDateTime } from '../utils/formatting.js';

export default function Dashboard({ onSelectPrediction }) {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [meData, histData] = await Promise.all([
        authService.getMe(),
        predictionService.getHistory(),
      ]);
      if (meData?.user) setUser(meData.user);
      setStats(meData?.stats || null);
      setItems(histData?.items || []);
    } catch (err) {
      setError(err.message || 'Unable to load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleOpenRecord = async (reportId) => {
    try {
      const fullRecord = await predictionService.getHistoryRecord(reportId);
      onSelectPrediction(fullRecord);
      navigate('/results');
    } catch (err) {
      setError(err.message || 'Unable to open screening record.');
    }
  };

  const handleDeleteRecord = async (reportId) => {
    try {
      await authService.deleteHistoryRecord(reportId);
      setItems((prev) => prev.filter((item) => item.reportId !== reportId));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              totalSavedScreenings: Math.max(0, (prev.totalSavedScreenings || 1) - 1),
            }
          : prev
      );
    } catch (err) {
      setError(err.message || 'Unable to delete screening record.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-5"
          title="Account Profile"
          subtitle="Manage your personal DermaSense AI account and privacy settings."
          action={
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Settings className="h-3.5 w-3.5" />
              Account Settings
            </Link>
          }
        >
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2.5">
              <dt className="flex items-center gap-2 text-slate-500">
                <User className="h-4 w-4" />
                Name
              </dt>
              <dd className="font-semibold text-slate-900">{user?.name || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2.5">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-mono text-xs text-slate-800">{user?.email || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-slate-500">
                <Calendar className="h-4 w-4" />
                Account Created
              </dt>
              <dd className="text-xs text-slate-700">{formatDateTime(user?.createdAt)}</dd>
            </div>
          </dl>
        </DashboardCard>

        <div className="lg:col-span-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total Saved Screenings</span>
              <Activity className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3 font-mono tabular-nums text-3xl font-bold text-slate-900">
              {loading ? '—' : stats?.totalSavedScreenings ?? items.length}
            </div>
            <div className="mt-1 text-xs text-slate-500">Stored without skin photographs</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Latest Screening</span>
              <Calendar className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-900">
              {loading
                ? 'Loading...'
                : items[0]?.analyzedAt
                  ? formatDateTime(items[0].analyzedAt)
                  : 'No screenings yet'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Most recent account record</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Privacy Protection</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-900">Metadata Only</div>
            <div className="mt-1 text-xs text-slate-500">
              Uploaded lesion images are never persisted to the database
            </div>
          </div>
        </div>
      </div>

      <DashboardCard
        title="Saved Screening History"
        subtitle="Your account screening summaries. Educational screening records are not confirmed medical diagnoses."
        action={
          <Link
            to="/analyze"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
          >
            New Screening
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading your saved screenings...</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">No saved screenings yet</div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-xl">
              When you run a lesion screening while signed in, the category, individual confidence, and contextual flags are saved here automatically without storing your uploaded skin photograph.
            </p>
            <Link
              to="/analyze"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Start Your First Screening
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Date &amp; Time</th>
                  <th className="py-2.5 pr-4 font-medium">Predicted Category</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Individual Confidence</th>
                  <th className="py-2.5 pr-4 font-medium">Screening Status</th>
                  <th className="py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.reportId} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 text-xs text-slate-600 whitespace-nowrap">
                      <div>{formatDateTime(item.analyzedAt)}</div>
                      <div className="font-mono text-[11px] text-slate-400">{item.reportId}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">
                        {item.predictedClass} — {item.fullCategoryName}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {item.confidencePercentage}%
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 font-medium ${
                          item.isLowConfidence
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {item.isLowConfidence ? 'Low Confidence (Uncertain)' : 'Above 70% Threshold'}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenRecord(item.reportId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => reportService.downloadScreeningPdf({ reportId: item.reportId })}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(item.reportId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          aria-label={`Delete screening ${item.reportId}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
