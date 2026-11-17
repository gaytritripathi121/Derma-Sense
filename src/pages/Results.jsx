import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Download, Eye, HeartHandshake, UserPlus } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import ConfidenceChart from '../components/ConfidenceChart.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { DISEASE_INFO } from '../data/diseaseInfo.js';
import { reportService } from '../services/reportService.js';
import { formatDateTime } from '../utils/formatting.js';

export default function Results({ prediction }) {
  const { user } = useAuth();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  if (!prediction) {
    return (
      <DashboardCard
        title="No Active Screening Result"
        subtitle="Upload a skin lesion photograph on the Analyze Lesion page to view CNN predictions, Grad-CAM maps, and clinical context flags."
      >
        <Link
          to="/analyze"
          className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Analyze a Lesion Image
        </Link>
      </DashboardCard>
    );
  }

  const isLowConfidence = Boolean(prediction.confidenceAssessment?.isLowConfidence);
  const info = DISEASE_INFO[prediction.predictedClass];
  const quality = prediction.imageQuality;
  const ctx = prediction.contextualAssessment;

  const handleDownloadPdf = async () => {
    setPdfError('');
    setDownloadingPdf(true);
    try {
      await reportService.downloadScreeningPdf({ record: prediction });
    } catch (err) {
      setPdfError(err.message || 'Failed to generate PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <div className="font-semibold">Clinical Screening Disclaimer</div>
        <p className="mt-1 text-amber-900 leading-relaxed">{prediction.disclaimer}</p>
      </div>

      {isLowConfidence && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            <div>
              <div className="font-semibold">
                LOW CONFIDENCE SCREENING ALERT (Below 70.0% Threshold)
              </div>
              <p className="mt-1 leading-relaxed">{prediction.confidenceAssessment?.message}</p>
            </div>
          </div>
        </div>
      )}

      {!user && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-5 py-3.5 text-xs text-blue-950">
          <div className="flex items-center gap-2.5">
            <UserPlus className="h-4 w-4 shrink-0 text-blue-700" />
            <span>Create a free account to save your screening history and access it later.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/register"
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 whitespace-nowrap"
            >
              Sign Up Free
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 font-medium text-blue-800 hover:bg-blue-50 whitespace-nowrap"
            >
              Log In
            </Link>
          </div>
        </div>
      )}

      {pdfError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
          {pdfError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-slate-500">
                Report {prediction.reportId} · {formatDateTime(prediction.analyzedAt)} · Model v{prediction.modelVersion}
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                {prediction.predictedClass} — {prediction.fullCategoryName}
              </h1>
              <div className="mt-2 text-sm font-medium text-slate-700">
                {isLowConfidence ? '▲ Low Confidence — Uncertain Prediction' : '● Above 70% Screening Threshold'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Individual Prediction Confidence</div>
              <div
                className={`mt-1 text-3xl font-bold font-mono tabular-nums ${
                  isLowConfidence ? 'text-amber-700' : 'text-blue-700'
                }`}
              >
                {prediction.confidencePercentage}%
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                Single-image score (not diagnostic accuracy)
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h2 className="text-sm font-semibold text-slate-900">Top Three Predictions</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(prediction.topThree || []).map((item, idx) => (
                <div key={item.code} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs text-slate-500">Rank #{idx + 1}</div>
                  <div className="mt-1 font-mono text-base font-bold text-slate-900">{item.code}</div>
                  <div className="text-xs text-slate-600 truncate">{item.fullName}</div>
                  <div className="mt-2 font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {item.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              {downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
            <Link
              to="/explainability"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Eye className="h-4 w-4" />
              Inspect Grad-CAM Lab
            </Link>
            <Link
              to="/safe-corner"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <HeartHandshake className="h-4 w-4" />
              Open Safe Corner Plan
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Grad-CAM Visual Attribution Preview</h2>
          {prediction.gradcam?.originalBase64 ? (
            <>
              <p className="mt-1 text-xs text-slate-500">
                Layer: <span className="font-mono">{prediction.gradcam?.layerName}</span> · Does not prove clinical significance
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <div className="border-b border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
                    Original Input
                  </div>
                  <img
                    src={prediction.gradcam?.originalBase64}
                    alt="Original lesion input"
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <div className="border-b border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
                    Grad-CAM Overlay
                  </div>
                  <img
                    src={prediction.gradcam?.overlayBase64}
                    alt="Grad-CAM saliency overlay"
                    className="aspect-square w-full object-cover"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
              Uploaded skin photographs and Grad-CAM overlays are not stored permanently in your account history to protect your privacy. Run a new screening to inspect live Grad-CAM maps.
            </div>
          )}

          {quality?.metrics && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="text-xs font-semibold text-slate-700">Image Quality Inspection</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums text-slate-600">
                <div>
                  Res: {quality.metrics.width}×{quality.metrics.height}
                </div>
                <div>Sharpness: {quality.metrics.sharpnessScore}</div>
                <div>Brightness: {quality.metrics.meanBrightness}</div>
              </div>
              {quality.warnings?.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-amber-800">
                  {quality.warnings.map((w, idx) => (
                    <li key={idx}>• {w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <DashboardCard
        title="Full 6-Class Softmax Probability Distribution"
        subtitle="Relative CNN scores across all six PAD-UFES-20 classes for this single image, shown against the 70% uncertainty gate (not overall diagnostic accuracy)."
      >
        <ConfidenceChart probabilities={prediction.allProbabilities} threshold={70} />
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Independent Patient-History Rule Engine"
          subtitle="Deterministic JSON rules evaluated separately from CNN image inference. Never alters model probabilities and is not SHAP."
        >
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">
              {ctx?.contextualStatusLabel || 'Evaluated'}
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {ctx?.overallRecommendation}
            </p>
          </div>

          {ctx?.triggeredFlags?.length ? (
            <div className="space-y-3">
              {ctx.triggeredFlags.map((flag) => (
                <div
                  key={flag.ruleId}
                  className="rounded-lg border border-slate-200 bg-white p-3.5 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{flag.title}</span>
                    <span
                      className={`font-mono text-xs font-semibold ${
                        flag.severity === 'HIGH_ATTENTION'
                          ? 'text-rose-700'
                          : flag.severity === 'MODERATE_ATTENTION'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                      }`}
                    >
                      {flag.severity} · {flag.ruleId}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{flag.explanation}</p>
                  <p className="mt-1.5 text-xs font-medium text-slate-800">
                    Suggested step: {flag.suggestedNextStep}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No elevated patient-history warning rules were triggered by the provided intake values.
            </p>
          )}
        </DashboardCard>

        <DashboardCard
          title="Condition Reference & Clinical Next Steps"
          subtitle={
            isLowConfidence
              ? 'Condition-specific guidance is withheld because model confidence is below 70%.'
              : `Educational overview for ${info?.fullName || prediction.predictedClass} (${prediction.predictedClass}).`
          }
        >
          {isLowConfidence ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p className="leading-relaxed">
                Because the CNN prediction did not meet the 70% confidence threshold (or entropy exceeded 0.85), DermaSense AI withholds condition-specific care notes to prevent premature anchoring on an uncertain prediction.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
                <li>Retake the photograph in bright, indirect natural light if blurred or glare-affected.</li>
                <li>Arrange an in-person evaluation with a qualified dermatologist or primary care physician.</li>
                <li>Read full educational notes for all 6 conditions in the Disease Guide.</li>
              </ul>
              <Link
                to="/diseases"
                className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                Open Disease Guide
              </Link>
            </div>
          ) : info ? (
            <div className="space-y-4 text-sm text-slate-700">
              <div className="text-xs text-slate-500">
                Category Group: <span className="font-semibold text-slate-800">{info.group}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{info.summary}</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800 leading-relaxed">
                <span className="font-semibold">Urgency Guidance: </span>
                {info.urgencyGuidance}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">Recommended Next Steps</div>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-slate-600">
                  {info.suggestedNextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </DashboardCard>
      </div>
    </div>
  );
}
