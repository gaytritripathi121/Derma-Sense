import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { modelApi } from '../services/api.js';
import { CLASS_CODES } from '../data/classMapping.js';
import { DISEASE_INFO } from '../data/diseaseInfo.js';

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

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <div className="font-semibold">
              Educational Skin-Lesion Screening &amp; Awareness Tool — Not a Medical Diagnostic System
            </div>
            <p className="mt-1 text-amber-900 leading-relaxed">
              DermaSense AI screens clinical skin lesion photographs across six dermatological categories using a trained convolutional neural network and Grad-CAM visual explanations. Individual prediction confidence reflects model score concentration on a single image—not overall diagnostic accuracy—and a benign-looking result never rules out skin cancer. Always consult a qualified dermatologist.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-7">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Explainable Dermatological Screening · Six-Class CNN · Grad-CAM Visual Explanations
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Explainable Six-Class Skin Lesion Screening &amp; Care Companion
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-600 leading-relaxed">
              Upload a clinical skin lesion photograph and optional symptom history to receive an automated six-class CNN screening assessment (ACK, BCC, MEL, NEV, SCC, SEK), Grad-CAM spatial attribution maps, independent clinical context flags, Safe Corner preventive routines, and a downloadable PDF screening summary.
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
            <p className="mt-1 text-xs text-slate-500">Integrated educational screening parameters</p>

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
                <dt className="text-slate-600">Supported Categories</dt>
                <dd className="font-mono tabular-nums font-medium text-slate-900">6 Lesion Types</dd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <dt className="text-slate-600">Individual Confidence Gate</dt>
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

      <DashboardCard
        title="Six Supported Skin Lesion Categories"
        subtitle="Educational screening categories derived from the PAD-UFES-20 clinical dermatology dataset."
        action={
          <Link
            to="/diseases"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
          >
            Full Condition Guide
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CLASS_CODES.map((code) => {
            const item = DISEASE_INFO[code];
            const isMalignant = item.group === 'Malignant skin cancer';
            const isPrecancer = item.group === 'Precancerous lesion';
            return (
              <div
                key={code}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{item.code}</span>
                    <span
                      className={`text-xs font-medium ${
                        isMalignant
                          ? 'text-rose-700'
                          : isPrecancer
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {item.group}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{item.fullName}</div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {item.summary}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </DashboardCard>

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
