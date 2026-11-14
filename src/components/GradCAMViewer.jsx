import React, { useState } from 'react';

const TABS = [
  { id: 'side', label: 'Side-by-Side' },
  { id: 'original', label: 'Original Image' },
  { id: 'heatmap', label: 'Grad-CAM Heatmap' },
  { id: 'overlay', label: 'Overlay' },
];

export default function GradCAMViewer({ gradcam, predictedClass }) {
  const [activeTab, setActiveTab] = useState('side');

  if (!gradcam) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No Grad-CAM spatial attribution output is loaded yet. Run a lesion screening analysis first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
          <span>Target: {predictedClass || '—'}</span>
          <span aria-hidden="true">·</span>
          <span>Layer: {gradcam.layerName}</span>
          <span aria-hidden="true">·</span>
          <span>Map: {gradcam.featureMapShape?.join('×')}</span>
          <span aria-hidden="true">·</span>
          <span>Focus &gt;0.5: {((gradcam.activeFocusRatio || 0) * 100).toFixed(1)}%</span>
          {gradcam.peakCoordinateNormalized && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Peak: ({gradcam.peakCoordinateNormalized.x}, {gradcam.peakCoordinateNormalized.y})
              </span>
            </>
          )}
        </div>
      </div>

      {activeTab === 'side' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { title: 'Original Lesion Input', src: gradcam.originalBase64 },
            { title: 'Grad-CAM Activation Map', src: gradcam.heatmapBase64 },
            { title: 'Combined Saliency Overlay', src: gradcam.overlayBase64 },
          ].map((panel) => (
            <div key={panel.title} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700">
                {panel.title}
              </div>
              <div className="aspect-square bg-slate-100">
                <img
                  src={panel.src}
                  alt={panel.title}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700">
            {TABS.find((t) => t.id === activeTab)?.label}
          </div>
          <div className="aspect-square bg-slate-100">
            <img
              src={
                activeTab === 'original'
                  ? gradcam.originalBase64
                  : activeTab === 'heatmap'
                    ? gradcam.heatmapBase64
                    : gradcam.overlayBase64
              }
              alt={`Grad-CAM ${activeTab} view`}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium text-slate-800">Jet Attribution Scale</span>
          <div className="flex items-center gap-2 font-mono">
            <span>0.0 (Low gradient)</span>
            <span className="h-2.5 w-36 rounded-sm bg-gradient-to-r from-blue-600 via-emerald-400 via-yellow-400 to-red-600" />
            <span>1.0 (Peak gradient)</span>
          </div>
        </div>
        <p className="leading-relaxed">
          {gradcam.explanationNote ||
            "Highlighted regions indicate image areas that contributed to the model's prediction. This visualization does not establish medical significance or provide clinical proof."}
        </p>
      </div>
    </div>
  );
}
