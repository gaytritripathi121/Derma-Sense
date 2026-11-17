import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { modelApi } from '../services/api.js';
import { CLASS_CODES } from '../data/classMapping.js';
import { DISEASE_INFO } from '../data/diseaseInfo.js';

export default function Performance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    modelApi
      .getMetrics()
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const cfg = data?.modelConfig || null;
  const imageSize = cfg?.preprocessing?.imageSize || 224;
  const architectureName = cfg?.architecture?.name || 'MobileNetV2 Transfer Learning Screening Model';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <div className="font-semibold">
              Educational Screening &amp; Awareness Tool — Not a Medical Diagnostic System
            </div>
            <p className="mt-1 text-amber-900 leading-relaxed">
              DermaSense AI is designed solely for dermatological screening awareness and educational exploration. It does not establish a medical diagnosis, cannot substitute for dermoscopy or biopsy, and never rules out malignancy. Individual image confidence scores reflect class probability concentration for a single photo rather than overall diagnostic certainty.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Screening Engine Status</div>
          <div className="mt-2 font-mono text-xl font-bold text-slate-900">
            {loading ? 'Checking...' : data?.modelAvailable ? '● Ready' : '▲ Unavailable'}
          </div>
          <div className="mt-1 text-xs text-slate-500">Offline local TensorFlow.js runtime</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Model Family</div>
          <div className="mt-2 font-mono text-sm font-bold text-slate-900 break-words">
            {architectureName}
          </div>
          <div className="mt-1 text-xs text-slate-500">Convolutional backbone + 6-class head</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Standardized Image Input</div>
          <div className="mt-2 font-mono tabular-nums text-xl font-bold text-slate-900">
            {imageSize}×{imageSize} RGB
          </div>
          <div className="mt-1 text-xs text-slate-500">Normalized clinical lesion tensor</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Individual Uncertainty Gate</div>
          <div className="mt-2 font-mono tabular-nums text-xl font-bold text-slate-900">70.0%</div>
          <div className="mt-1 text-xs text-slate-500">Triggers low-confidence safety alert</div>
        </div>
      </div>

      <DashboardCard
        title="How the DermaSense AI Prediction Process Works"
        subtitle="Each uploaded photograph passes through four transparent, separated stages before displaying an educational screening summary."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              1. Image Validation &amp; Quality Inspection
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Uploaded JPG or PNG files are decoded strictly in server RAM and checked for minimum resolution, brightness balance, and Laplacian sharpness. Quality warnings alert you when glare, blur, or dim lighting may obscure skin features.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              2. Six-Class Convolutional Feature Extraction
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              The image is resized to {imageSize}×{imageSize} RGB pixels and evaluated across all six dermatological categories represented in PAD-UFES-20 (ACK, BCC, MEL, NEV, SCC, SEK) to produce a six-way softmax distribution.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              3. Individual Confidence Indicator &amp; 70% Safety Gate
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              For each individual screening, the highest softmax score indicates how strongly the image activated one category relative to the other five. If top confidence is below 70% or distribution entropy is high, DermaSense AI flags the result as uncertain and withholds condition-specific care notes. This individual confidence score is not a statement of overall model accuracy.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">
              4. Grad-CAM Visual Explanation &amp; Separate Context Rules
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Gradient-weighted Class Activation Mapping (Grad-CAM) highlights which image pixels most influenced the predicted class logit. Optional patient-reported symptoms are evaluated separately by transparent JSON rules without altering CNN image scores.
            </p>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard
        title="Supported Six-Class Skin Lesion Categories"
        subtitle="DermaSense AI screens photographs exclusively across these six categories. Other skin conditions are outside its scope."
        action={
          <div className="flex items-center gap-3">
            <Link
              to="/diseases"
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
            >
              Detailed Condition Guide
            </Link>
            <Link
              to="/analyze"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
            >
              Analyze Image
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CLASS_CODES.map((code) => {
            const item = DISEASE_INFO[code];
            return (
              <div key={code} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900">{item.code}</span>
                  <span className="text-xs font-medium text-slate-500">{item.group}</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{item.fullName}</div>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{item.summary}</p>
              </div>
            );
          })}
        </div>
      </DashboardCard>
    </div>
  );
}
