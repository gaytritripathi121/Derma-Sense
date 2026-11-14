import React from 'react';

const YES_NO_UNKNOWN = [
  { value: 'UNKNOWN', label: 'Unknown / Not sure' },
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
];

const ANATOMICAL_REGIONS = [
  'UNKNOWN',
  'FACE',
  'SCALP',
  'EAR',
  'NECK',
  'CHEST',
  'BACK',
  'ABDOMEN',
  'FOREARM',
  'ARM',
  'HAND',
  'THIGH',
  'FOOT',
  'LIP',
  'NOSE',
  'OTHER',
];

export default function PatientHistoryForm({ value, onChange }) {
  const update = (field, nextVal) => {
    onChange({
      ...value,
      [field]: nextVal,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 leading-relaxed">
        Patient-history fields are optional. They are evaluated solely by a transparent heuristic rule base to highlight red-flag context and never modify CNN image probabilities.
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-700">Patient Initials (Optional)</span>
          <input
            type="text"
            maxLength={8}
            placeholder="e.g. A.M."
            value={value.patientInitials || ''}
            onChange={(e) => update('patientInitials', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Age (Years)</span>
          <input
            type="number"
            min={0}
            max={120}
            placeholder="e.g. 58"
            value={value.age ?? ''}
            onChange={(e) => update('age', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono tabular-nums focus:border-blue-600 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Gender</span>
          <select
            value={value.gender || 'UNKNOWN'}
            onChange={(e) => update('gender', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="UNKNOWN">Prefer not to say / Unknown</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_DISCLOSE">Prefer not to disclose</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Fitzpatrick Skin Type</span>
          <select
            value={value.fitzpatrickType || 'UNKNOWN'}
            onChange={(e) => update('fitzpatrickType', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="UNKNOWN">Unknown</option>
            <option value="1">Type I — Always burns, never tans</option>
            <option value="2">Type II — Usually burns, tans minimally</option>
            <option value="3">Type III — Sometimes burns, tans uniformly</option>
            <option value="4">Type IV — Burns minimally, always tans well</option>
            <option value="5">Type V — Very rarely burns, tans very easily</option>
            <option value="6">Type VI — Never burns, deeply pigmented</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Anatomical Region</span>
          <select
            value={value.region || 'UNKNOWN'}
            onChange={(e) => update('region', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            {ANATOMICAL_REGIONS.map((reg) => (
              <option key={reg} value={reg}>
                {reg === 'UNKNOWN' ? 'Unknown / Unspecified' : reg.charAt(0) + reg.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Approximate Diameter (mm)</span>
          <input
            type="number"
            min={0}
            max={200}
            step="0.5"
            placeholder="e.g. 7.5"
            value={value.diameterMm ?? ''}
            onChange={(e) => update('diameterMm', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono tabular-nums focus:border-blue-600 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Personal Skin Cancer History</span>
          <select
            value={value.personalSkinCancerHistory || 'UNKNOWN'}
            onChange={(e) => update('personalSkinCancerHistory', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            {YES_NO_UNKNOWN.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Family Skin Cancer History</span>
          <select
            value={value.familySkinCancerHistory || 'UNKNOWN'}
            onChange={(e) => update('familySkinCancerHistory', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            {YES_NO_UNKNOWN.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Lesion Duration</span>
          <select
            value={value.lesionDuration || 'UNKNOWN'}
            onChange={(e) => update('lesionDuration', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="UNKNOWN">Unknown</option>
            <option value="LESS_THAN_1_MONTH">Less than 1 month</option>
            <option value="1_TO_6_MONTHS">1 to 6 months</option>
            <option value="6_TO_12_MONTHS">6 to 12 months</option>
            <option value="OVER_1_YEAR">Over 1 year</option>
          </select>
        </label>
      </div>

      <div>
        <div className="mb-3 text-xs font-semibold text-slate-700">
          Lesion Symptoms &amp; Clinical Changes (PAD-UFES-20 Attributes)
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { field: 'changed', label: 'Recent Color or Shape Change' },
            { field: 'grew', label: 'Recent Lesion Growth' },
            { field: 'bleed', label: 'Spontaneous Bleeding / Oozing' },
            { field: 'hurt', label: 'Pain or Tenderness' },
            { field: 'itch', label: 'Persistent Itching' },
            { field: 'elevation', label: 'Elevated / Raised Surface' },
          ].map((item) => (
            <label key={item.field} className="block">
              <span className="text-xs font-medium text-slate-700">{item.label}</span>
              <select
                value={value[item.field] || 'UNKNOWN'}
                onChange={(e) => update(item.field, e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {YES_NO_UNKNOWN.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-700">Itch Severity</span>
          <select
            value={value.itchSeverity || 'UNKNOWN'}
            onChange={(e) => update('itchSeverity', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="UNKNOWN">Unknown</option>
            <option value="NONE">None</option>
            <option value="MILD">Mild</option>
            <option value="MODERATE">Moderate</option>
            <option value="SEVERE">Severe</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Relevant Medical History Notes</span>
          <input
            type="text"
            maxLength={500}
            placeholder="e.g. Prior basal cell excision on nose in 2021, immunosuppressant therapy"
            value={value.relevantMedicalHistory || ''}
            onChange={(e) => update('relevantMedicalHistory', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}
