import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard.jsx';
import GradCAMViewer from '../components/GradCAMViewer.jsx';
import { modelApi } from '../services/api.js';

export default function Explainability({ prediction }) {
  const [rulesData, setRulesData] = useState(null);

  useEffect(() => {
    modelApi
      .getRules()
      .then(setRulesData)
      .catch(() => setRulesData(null));
  }, []);

  return (
    <div className="space-y-6">
      <DashboardCard
        title="Grad-CAM Spatial Attribution Lab"
        subtitle="Gradient-weighted Class Activation Mapping computed directly via tf.grad from pre-softmax logits back to the final convolutional activation layer."
        action={
          !prediction && (
            <Link
              to="/analyze"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
            >
              Run New Screening
            </Link>
          )
        }
      >
        <GradCAMViewer
          gradcam={prediction?.gradcam}
          predictedClass={prediction?.predictedClass}
        />
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard
          title="How DermaSense Grad-CAM Works"
          subtitle="Mathematical transparency of visual attribution without synthetic heatmap overlays."
        >
          <ol className="space-y-3 text-sm text-slate-600 leading-relaxed list-decimal pl-5">
            <li>
              <span className="font-medium text-slate-900">Spatial Feature Extraction:</span> The normalized RGB lesion tensor (224×224×3 for the active MobileNetV2 screening model) passes through the convolutional backbone into the final spatial activation tensor (7×7×1280 at <span className="font-mono text-xs">Conv_1/Relu6</span>).
            </li>
            <li>
              <span className="font-medium text-slate-900">Logit Gradient Computation:</span> Automatic differentiation (<span className="font-mono text-xs">tf.grad</span>) computes gradients of the target class pre-softmax logit with respect to each spatial feature channel.
            </li>
            <li>
              <span className="font-medium text-slate-900">Channel Weighting &amp; ReLU:</span> Global average pooling of channel gradients produces importance weights, followed by weighted summation, ReLU rectification, min-max normalization, and bicubic upsampling to match original resolution.
            </li>
            <li>
              <span className="font-medium text-slate-900">Clinical Boundary:</span> Grad-CAM reveals where the CNN looked, not why a region is benign or malignant histologically. Artifacts such as hair, rulers, or ink can also attract high gradients.
            </li>
          </ol>
        </DashboardCard>

        <DashboardCard
          title="Transparent Heuristic Rule Knowledge Base"
          subtitle="Independent clinical context rules (rules.json). Audited separately from CNN weights and explicitly distinct from SHAP."
        >
          {rulesData?.rules ? (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 pr-1">
              {rulesData.rules.map((r) => (
                <div key={r.ruleId} className="py-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{r.title}</span>
                    <span className="font-mono text-slate-500">
                      {r.ruleId} · {r.severity}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-slate-500">
                    Trigger: {r.field} {r.operator || 'EQUALS'} {JSON.stringify(r.expected ?? r.value)}
                  </div>
                  <p className="mt-1 text-slate-600 leading-relaxed">{r.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading rule knowledge base...</p>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
