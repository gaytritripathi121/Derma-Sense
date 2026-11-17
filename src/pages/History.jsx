import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Eye, FileText, Trash2 } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { predictionService } from '../services/predictionService.js';
import { reportService } from '../services/reportService.js';
import { formatDateTime } from '../utils/formatting.js';

export default function History({ onSelectPrediction }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [accountScoped, setAccountScoped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await predictionService.getHistory();
      setItems(data.items || []);
      setAccountScoped(Boolean(data.accountScoped));
    } catch (err) {
      setError(err.message || 'Failed to load session history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user?.id]);

  const handleOpenRecord = async (reportId) => {
    try {
      const fullRecord = await predictionService.getHistoryRecord(reportId);
      onSelectPrediction(fullRecord);
      navigate('/results');
    } catch (err) {
      setError(err.message || 'Unable to load screening record.');
    }
  };

  const handleClear = async () => {
    try {
      await predictionService.clearHistory();
      setItems([]);
    } catch (err) {
      setError(err.message || 'Unable to clear session history.');
    }
  };

  return (
    <div className="space-y-6">
      <DashboardCard
        title={accountScoped ? 'Saved Account Screening History' : 'Ephemeral Session Screening History'}
        subtitle={
          accountScoped
            ? 'Screening summaries saved to your DermaSense AI account. Uploaded skin photographs are never persisted to the database.'
            : 'Predictions are held strictly in temporary cookie-scoped server memory for your active session and are never persisted permanently.'
        }
        action={
          items.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {accountScoped ? 'Clear Saved History' : 'Clear Session History'}
            </button>
          )
        }
      >
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading session history...</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            <p>No screening runs recorded in this browser session yet.</p>
            <Link
              to="/analyze"
              className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Analyze a Lesion Image
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Preview</th>
                  <th className="py-2.5 pr-4 font-medium">Report ID</th>
                  <th className="py-2.5 pr-4 font-medium">Prediction</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Confidence</th>
                  <th className="py-2.5 pr-4 font-medium">Analyzed</th>
                  <th className="py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.reportId} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      {item.thumbnailBase64 ? (
                        <img
                          src={item.thumbnailBase64}
                          alt={item.predictedClass}
                          className="h-12 w-12 rounded-md border border-slate-200 object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-400"
                          title="Image not stored for privacy"
                        >
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700">{item.reportId}</td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900">
                        {item.predictedClass} — {item.fullCategoryName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.isLowConfidence ? '▲ Low Confidence' : '● Above Threshold'}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {item.confidencePercentage}%
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(item.analyzedAt)}
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
