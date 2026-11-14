import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { modelApi } from '../services/api.js';
import { formatNumber, formatPercent } from '../utils/formatting.js';

export default function Home({ currentPrediction }) {
  const [metricsData, setMetricsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    modelApi
      .getMetrics()
      .then((res) => {
        if (active) setMetricsData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const evalMetrics = metricsData?.evaluation || null;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <div className="font-semibold">
              Experimental Academic Screening Tool — Not a Medical Diagnosis
            </div>
            <p className="mt-1 text-amber-900 leading-relaxed">
              DermaSense AI screens clinical skin lesion photographs across six dermatological categories using a trained convolutional neural network and Grad-CAM visual attribution. Predictions are preliminary, model confidence is not diagnostic probability, and a benign-looking result never rules out skin cancer. Always consult a qualified dermatologist.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-7">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Explainable Dermatological Screening · PAD-UFES-20 Six-Class CNN · Grad-CAM
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Explainable Six-Class Skin Lesion Screening &amp; Care Companion
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600 leading-relaxed">
              Upload a clinical skin lesion photograph and optional symptom history to receive an automated six-class CNN screening assessment (ACK, BCC, MEL, NEV, SCC, SEK), Grad-CAM spatial attribution maps, independent clinical context flags, Safe Corner preventive routines, and a downloadable PDF screening report.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Start Lesion Screening
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/safe-corner"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Safe Corner Planner
            </Link>
            <Link
              to="/diseases"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Condition Guide
            </Link>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Screening System Overview</h2>
            <p className="mt-1 text-xs text-slate-500">Integrated clinical screening parameters</p>

            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <dt className="text-slate-600">Screening Engine</dt>
                <dd className="font-mono font-medium text-slate-900">
                  {loading
                    ? 'Checking...'
                    : metricsData?.modelAvailable
                      ? '● Ready'
                      : '▲ Unavailable'}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <dt className="text-slate-600">Target Categories</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900">6 Classes</dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <dt className="text-slate-600">Confidence Safety Gate</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900">70.0%</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-600">Privacy Retention</dt>
                <dd className="font-medium text-slate-900">Session RAM only</dd>
              </div>
            </dl>
          </div>

          {currentPrediction && (
            <Link
              to="/results"
              className="mt-5 block rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-800 hover:bg-blue-100 transition-colors"
            >
              Active Session Report: {currentPrediction.predictedClass} ({currentPrediction.confidencePercentage}%) — View Results
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Held-Out Test Accuracy',
            value: evalMetrics ? formatPercent(evalMetrics.accuracy, 2) : '—',
            detail: evalMetrics
              ? `Evaluated on ${formatNumber(evalMetrics.testSampleCount)} unseen clinical images`
              : 'Verified held-out evaluation',
          },
          {
            label: 'Held-Out Macro-F1',
            value: evalMetrics ? formatPercent(evalMetrics.macroF1, 2) : '—',
            detail: evalMetrics
              ? `Macro-Recall ${formatPercent(evalMetrics.macroRecall, 2)}`
              : 'Balanced 6-class evaluation score',
          },
          {
            label: 'Macro ROC-AUC',
            value: evalMetrics?.macroRocAuc ? evalMetrics.macroRocAuc.toFixed(3) : '—',
            detail: 'One-vs-rest six-class discrimination',
          },
          {
            label: 'Target Screening Classes',
            value: '6 Classes',
            detail: 'ACK · BCC · MEL · NEV · SCC · SEK',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
              {kpi.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">{kpi.detail}</div>
          </div>
        ))}
      </div>

      <DashboardCard
        title="How Clinical Screening Works"
        subtitle="Designed with clear boundaries between image prediction, visual explainability, and patient-reported clinical context."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '01. Upload & Quality Gate',
              desc: 'Upload a JPG or PNG skin lesion photograph. Automated checks verify resolution, lighting exposure, and image sharpness before screening.',
              to: '/analyze',
              cta: 'Upload Lesion Photo',
            },
            {
              step: '02. Six-Class CNN Screening',
              desc: 'Our trained CNN evaluates visual patterns across ACK, BCC, MEL, NEV, SCC, and SEK, enforcing an explicit 70% low-confidence safety alert.',
              to: '/results',
              cta: 'View Results Format',
            },
            {
              step: '03. Grad-CAM Attribution',
              desc: 'Inspect side-by-side Grad-CAM heatmaps and overlays highlighting which image pixels drove the predicted class logit.',
              to: '/explainability',
              cta: 'Open Grad-CAM Lab',
            },
            {
              step: '04. Safe Corner & PDF Report',
              desc: 'Review independent red-flag history rules, follow confidence-gated photoprotection & ABCDE logs, export .ics invites, and download a PDF summary.',
              to: '/safe-corner',
              cta: 'Open Safe Corner',
            },
          ].map((item) => (
            <div key={item.step} className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{item.step}</h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
              <Link
                to={item.to}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                {item.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}
