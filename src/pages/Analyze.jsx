import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import ImageUploader from '../components/ImageUploader.jsx';
import PatientHistoryForm from '../components/PatientHistoryForm.jsx';
import LoadingState from '../components/LoadingState.jsx';
import { modelApi } from '../services/api.js';
import { predictionService } from '../services/predictionService.js';

const INITIAL_HISTORY = {
  patientInitials: '',
  age: '',
  gender: 'UNKNOWN',
  fitzpatrickType: 'UNKNOWN',
  region: 'UNKNOWN',
  diameterMm: '',
  personalSkinCancerHistory: 'UNKNOWN',
  familySkinCancerHistory: 'UNKNOWN',
  relevantMedicalHistory: '',
  itch: 'UNKNOWN',
  itchSeverity: 'UNKNOWN',
  lesionDuration: 'UNKNOWN',
  grew: 'UNKNOWN',
  changed: 'UNKNOWN',
  hurt: 'UNKNOWN',
  bleed: 'UNKNOWN',
  elevation: 'UNKNOWN',
};

export default function Analyze({ onPredictionComplete }) {
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [patientHistory, setPatientHistory] = useState(INITIAL_HISTORY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [modelReady, setModelReady] = useState(true);

  useEffect(() => {
    modelApi
      .getMetrics()
      .then((res) => setModelReady(Boolean(res?.modelAvailable)))
      .catch(() => setModelReady(true));
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      setError('Please select a JPG, JPEG, or PNG lesion image before running screening.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const result = await predictionService.analyzeLesion({
        imageFile,
        patientHistory,
      });
      onPredictionComplete(result);
      navigate('/results');
    } catch (err) {
      setError(err.message || 'Screening request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!modelReady && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <div className="font-semibold">Screening Model Unavailable</div>
              <p className="mt-0.5 text-amber-900">
                The trained screening model is currently offline or initializing. Please check back shortly or consult a qualified dermatologist directly.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <DashboardCard
          title="01. Lesion Image Upload & Quality Gate"
          subtitle="Images are checked for decoding integrity, resolution, blur (Laplacian variance), and over/under-exposure before CNN inference."
        >
          <ImageUploader
            file={imageFile}
            previewUrl={previewUrl}
            onFileSelect={(file) => {
              setError('');
              setImageFile(file);
            }}
            onClear={() => {
              setImageFile(null);
              setError('');
            }}
          />
        </DashboardCard>

        <DashboardCard
          title="02. Optional Patient Clinical Context"
          subtitle="Evaluated separately by our deterministic JSON rule engine to flag red-flag symptoms. Does not modify CNN probabilities."
          action={
            <button
              type="button"
              onClick={() => setPatientHistory(INITIAL_HISTORY)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            >
              Reset Form
            </button>
          }
        >
          <PatientHistoryForm value={patientHistory} onChange={setPatientHistory} />
        </DashboardCard>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>{error}</div>
          </div>
        )}

        {submitting ? (
          <LoadingState
            title="Running CNN Inference & Grad-CAM Attribution"
            detail="Evaluating image quality metrics, computing 6-class softmax scores, generating Grad-CAM overlays, and checking contextual clinical flags..."
            rows={2}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              By submitting, you acknowledge this is an academic screening prototype. Uploaded photographs remain ephemeral in session memory and are never stored permanently on disk.
            </p>
            <button
              type="submit"
              disabled={!imageFile || submitting}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 transition-colors whitespace-nowrap"
            >
              Run Screening Analysis
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
