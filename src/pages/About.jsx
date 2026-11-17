import React from 'react';
import DashboardCard from '../components/DashboardCard.jsx';

export default function About() {
  return (
    <div className="space-y-6">
      <DashboardCard
        title="DermaSense AI — System Architecture & Academic Methodology"
        subtitle="B.Tech Computer Science Academic Project · Full-Stack JavaScript (Node.js / Express / React / TensorFlow.js)"
      >
        <div className="space-y-4 text-sm text-slate-600 leading-relaxed max-w-3xl">
          <p>
            DermaSense AI is an educational skin-lesion screening and awareness tool—not a medical diagnostic system. It demonstrates an end-to-end explainable screening pipeline trained directly in JavaScript using <span className="font-mono text-xs text-slate-900">@tensorflow/tfjs-node</span> on the official Mendeley PAD-UFES-20 clinical smartphone photography dataset.
          </p>
          <p>
            To prevent patient-level and lesion-level overlap during training preparation, records are grouped via disjoint Union-Find clustering across both <span className="font-mono text-xs text-slate-900">patient_id</span> and <span className="font-mono text-xs text-slate-900">lesion_id</span>. Individual prediction confidence reported during screening reflects single-image class score concentration for uncertainty gating, not overall diagnostic accuracy.
          </p>
        </div>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardCard title="Architectural Separation of Concerns">
          <ul className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <li>
              <span className="font-semibold text-slate-900">1. Pure Image CNN:</span> Evaluates 224×224×3 normalized lesion images with an ImageNet-pretrained MobileNetV2 backbone and regularized six-class head outputting softmax probabilities.
            </li>
            <li>
              <span className="font-semibold text-slate-900">2. Genuine Grad-CAM Engine:</span> Differentiates raw pre-softmax logits with respect to the final spatial convolutional feature map (<span className="font-mono text-xs">Conv_1/Relu6</span>) via <span className="font-mono text-xs">tf.grad</span> to reveal spatial image focus.
            </li>
            <li>
              <span className="font-semibold text-slate-900">3. Independent Rule Engine:</span> Evaluates patient symptoms and history from a transparent JSON rule base without altering CNN scores or falsely claiming SHAP attribution.
            </li>
            <li>
              <span className="font-semibold text-slate-900">4. Confidence-Gated Safe Corner:</span> Withholds condition-specific wellness advice whenever confidence falls below 70% or entropy is high.
            </li>
          </ul>
        </DashboardCard>

        <DashboardCard title="Dataset Citation, Privacy &amp; Limitations">
          <ul className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <li>
              <span className="font-semibold text-slate-900">Dataset Attribution:</span> Pacheco, A.G.C., Lima, G.R., Salomão, A.S. et al. PAD-UFES-20: A skin lesion dataset composed of patient data and clinical images collected from smartphones. <span className="italic">Data in Brief</span>, 2020 (Mendeley Data zr7vgbcyr2 v1).
            </li>
            <li>
              <span className="font-semibold text-slate-900">Privacy Policy:</span> Uploaded screening photos are processed purely in RAM and stored transiently in ephemeral session buckets—never written permanently to disk.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Key Limitations:</span> Smartphone photographs lack polarized dermoscopic subsurface detail; class imbalance exists (especially Melanoma with 52 samples); and raw softmax scores are uncalibrated academic estimates, not clinical certainty.
            </li>
          </ul>
        </DashboardCard>
      </div>
    </div>
  );
}
