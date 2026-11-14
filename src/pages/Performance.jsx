import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DashboardCard from '../components/DashboardCard.jsx';
import { modelApi } from '../services/api.js';
import { formatDateTime, formatNumber, formatPercent } from '../utils/formatting.js';

export default function Performance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    modelApi
      .getMetrics()
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load model validation metrics.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading clinical held-out model validation metrics...</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
        {error}
      </div>
    );
  }

  const evalMetrics = data?.evaluation;
  const cfg = data?.modelConfig;

  if (!evalMetrics) {
    return (
      <DashboardCard
        title="Held-Out Clinical Validation Summary Unavailable"
        subtitle="Evaluation metrics are not currently loaded on the server."
      >
        <p className="text-sm text-slate-600">
          Validation benchmarks appear here once the trained PAD-UFES-20 model evaluation artifact is available.
        </p>
      </DashboardCard>
    );
  }

  const calibrationChart = (evalMetrics.calibrationBins || [])
    .filter((b) => b.count > 0)
    .map((b) => ({
      bin: b.bin,
      confidence: Number((b.avgConfidence * 100).toFixed(1)),
      accuracy: Number((b.empiricalAccuracy * 100).toFixed(1)),
      count: b.count,
    }));

  const perClassChart = (evalMetrics.perClass || []).map((c) => ({
    code: c.code,
    f1: Number((c.f1 * 100).toFixed(1)),
    recall: Number((c.recall * 100).toFixed(1)),
    precision: Number((c.precision * 100).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Test Accuracy', value: formatPercent(evalMetrics.accuracy, 2) },
          { label: 'Macro Precision', value: formatPercent(evalMetrics.macroPrecision, 2) },
          { label: 'Macro Recall', value: formatPercent(evalMetrics.macroRecall, 2) },
          { label: 'Macro F1-Score', value: formatPercent(evalMetrics.macroF1, 2) },
          {
            label: 'Macro ROC-AUC',
            value: evalMetrics.macroRocAuc !== null ? evalMetrics.macroRocAuc.toFixed(4) : '—',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs text-slate-500">{kpi.label}</div>
            <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <DashboardCard
          className="lg:col-span-7"
          title="6×6 Held-Out Test Confusion Matrix"
          subtitle={`Evaluated on n=${formatNumber(evalMetrics.testSampleCount)} unseen patient-grouped images (${formatDateTime(evalMetrics.evaluatedAt)}). Rows = ground truth, Columns = predicted.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 text-left">True \ Pred</th>
                  {evalMetrics.classOrder.map((c) => (
                    <th key={c} className="px-2 py-2 font-semibold text-slate-800">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evalMetrics.confusionMatrix.map((row, rIdx) => {
                  const rowSum = Math.max(1, row.reduce((a, b) => a + b, 0));
                  return (
                    <tr key={evalMetrics.classOrder[rIdx]}>
                      <td className="py-2 pr-3 text-left font-semibold text-slate-900">
                        {evalMetrics.classOrder[rIdx]}
                      </td>
                      {row.map((val, cIdx) => {
                        const ratio = val / rowSum;
                        const isDiag = rIdx === cIdx;
                        const bg = isDiag
                          ? ratio > 0.5
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-blue-100 text-blue-950 font-semibold'
                          : val > 0
                            ? 'bg-amber-50 text-amber-900'
                            : 'bg-slate-50 text-slate-400';
                        return (
                          <td key={cIdx} className={`border border-white px-2.5 py-2 ${bg}`}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        <DashboardCard
          className="lg:col-span-5"
          title="Per-Class Held-Out Metrics"
          subtitle={`Weighted F1: ${formatPercent(evalMetrics.weightedF1, 2)} · ECE: ${evalMetrics.expectedCalibrationError}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-2 font-medium">Class</th>
                  <th className="py-2 pr-2 text-right font-medium">Support</th>
                  <th className="py-2 pr-2 text-right font-medium">Prec</th>
                  <th className="py-2 pr-2 text-right font-medium">Recall</th>
                  <th className="py-2 pr-2 text-right font-medium">F1</th>
                  <th className="py-2 text-right font-medium">AUC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {evalMetrics.perClass.map((row) => (
                  <tr key={row.code}>
                    <td className="py-2 pr-2 font-semibold text-slate-900">{row.code}</td>
                    <td className="py-2 pr-2 text-right">{row.support}</td>
                    <td className="py-2 pr-2 text-right">{(row.precision * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-2 text-right">{(row.recall * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-2 text-right font-semibold">{(row.f1 * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right">{row.rocAuc !== null ? row.rocAuc.toFixed(3) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard title="Per-Class Precision, Recall &amp; F1 (%)">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perClassChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="code" tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="precision" name="Precision %" fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="recall" name="Recall %" fill="#0d9488" radius={[3, 3, 0, 0]} />
                <Bar dataKey="f1" name="F1 %" fill="#475569" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        <DashboardCard
          title="Confidence Calibration Curve"
          subtitle="Compares predicted softmax confidence bins against empirical test accuracy."
        >
          {calibrationChart.length ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={calibrationChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bin" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="confidence" name="Avg Confidence %" stroke="#94a3b8" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="accuracy" name="Empirical Accuracy %" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Insufficient calibration bins populated.</p>
          )}
        </DashboardCard>
      </div>

      {cfg && (
        <DashboardCard title="Model Specification">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
            <div>
              <div className="text-slate-500">Architecture</div>
              <div className="mt-1 font-mono font-semibold text-slate-900">{cfg.architecture?.name}</div>
            </div>
            <div>
              <div className="text-slate-500">Input Resolution</div>
              <div className="mt-1 font-mono tabular-nums font-semibold text-slate-900">
                {cfg.preprocessing?.imageSize || 192}×{cfg.preprocessing?.imageSize || 192} RGB
              </div>
            </div>
            <div>
              <div className="text-slate-500">Dataset Reference</div>
              <div className="mt-1 font-medium text-slate-900">PAD-UFES-20 (Patient-Isolated Split)</div>
            </div>
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
