import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { CLASS_CODES } from '../data/classMapping.js';
import { DISEASE_INFO } from '../data/diseaseInfo.js';

export default function DiseaseInfo() {
  const [selectedCode, setSelectedCode] = useState('ALL');

  const items =
    selectedCode === 'ALL'
      ? CLASS_CODES.map((c) => DISEASE_INFO[c])
      : [DISEASE_INFO[selectedCode]];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-bold text-slate-900">
          Six-Class PAD-UFES-20 Skin Condition Reference
        </h1>
        <p className="mt-1 text-sm text-slate-600 leading-relaxed">
          Educational reference for all diagnostic categories represented in the PAD-UFES-20 dataset. Note that Bowen&apos;s disease is grouped into Squamous Cell Carcinoma (SCC).
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            type="button"
            onClick={() => setSelectedCode('ALL')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              selectedCode === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All 6 Classes
          </button>
          {CLASS_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedCode(code)}
              className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCode === code
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {items.map((item) => (
          <DashboardCard
            key={item.code}
            title={`${item.code} — ${item.fullName}`}
            subtitle={`Clinical Classification: ${item.group}`}
          >
            <div className="space-y-4 text-sm text-slate-700">
              <p className="leading-relaxed text-slate-600">{item.summary}</p>

              <div>
                <h3 className="text-xs font-semibold text-slate-900">Typical Visual Characteristics</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-slate-600">
                  {item.characteristics.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed">
                <div className="font-semibold text-slate-900">Risk &amp; Urgency Context</div>
                <p className="mt-1 text-slate-600">{item.riskInformation}</p>
                <p className="mt-2 font-medium text-slate-900">{item.urgencyGuidance}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-900">Suggested Next Steps</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-slate-600">
                  {item.suggestedNextSteps.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-4 text-xs">
                {item.sources.map((src) => (
                  <a
                    key={src.url}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                  >
                    {src.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          </DashboardCard>
        ))}
      </div>
    </div>
  );
}
