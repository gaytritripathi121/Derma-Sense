function parseTimeToMinutes(hhmm = '07:00', fallback = 420) {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return h * 60 + min;
}

function formatMinutes(totalMin) {
  const norm = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function generateSafeCornerPlan({
  predictedClass = null,
  isLowConfidence = true,
  patientHistory = {},
  wakeTime = '07:00',
  sleepTime = '22:30',
  preferences = {},
} = {}) {
  const wakeMin = parseTimeToMinutes(wakeTime, 420);
  const sleepMin = parseTimeToMinutes(sleepTime, 1350);
  const fitz = String(patientHistory.fitzpatrickType || 'UNKNOWN');
  const sensitiveSkin = fitz === '1' || fitz === '2' || preferences.sensitiveSkin;
  const hasIrritatedSymptoms =
    patientHistory.bleed === 'YES' || patientHistory.hurt === 'YES' || patientHistory.itch === 'YES';

  const canUseDiseaseSpecific = Boolean(predictedClass && !isLowConfidence);

  const schedule = [
    {
      id: 'morning-cleanse',
      time: formatMinutes(wakeMin + 15),
      period: 'Morning',
      category: 'Gentle Skincare',
      title: sensitiveSkin ? 'Ultra-gentle fragrance-free cleanse' : 'Mild pH-balanced skin cleanse',
      details: hasIrritatedSymptoms
        ? 'Use lukewarm water only around tender or bleeding skin. Pat dry gently—never scrub or apply harsh exfoliants.'
        : 'Wash gently with lukewarm water and a non-irritating cleanser; pat dry with a soft towel.',
    },
    {
      id: 'morning-sunscreen',
      time: formatMinutes(wakeMin + 30),
      period: 'Morning',
      category: 'Sun Protection',
      title: 'Apply broad-spectrum SPF 30+ (or SPF 50+) sunscreen',
      details: sensitiveSkin
        ? 'Fair / UV-sensitive phototype detected: prioritize mineral zinc-oxide or titanium-dioxide SPF 50+ on all exposed areas.'
        : 'Apply generously 15 minutes before outdoor exposure covering face, neck, ears, forearms, and hands.',
    },
    {
      id: 'hydration-midmorning',
      time: formatMinutes(wakeMin + 180),
      period: 'Mid-Morning',
      category: 'Hydration',
      title: 'Hydration & barrier comfort check',
      details: 'Drink a full glass of water and avoid prolonged midday direct sun between 10:00 AM and 4:00 PM.',
    },
    {
      id: 'sunscreen-reapply',
      time: formatMinutes(wakeMin + 300),
      period: 'Midday',
      category: 'Sunscreen Reapplication',
      title: 'Reapply sunscreen & wear UV-protective gear',
      details: 'Reapply SPF every 2 hours when outdoors (or after sweating/swimming). Pair with a wide-brimmed hat and UPF clothing.',
    },
    {
      id: 'afternoon-observation',
      time: formatMinutes(wakeMin + 480),
      period: 'Afternoon',
      category: 'Skin Monitoring',
      title: 'Midday lesion protection & clothing check',
      details: 'Ensure clothing does not rub or chafe raised lesions; cover healing or fragile areas with a clean non-stick dressing if advised by a clinician.',
    },
    {
      id: 'evening-cleanse',
      time: formatMinutes(sleepMin - 45),
      period: 'Evening',
      category: 'Gentle Skincare',
      title: 'Evening cleanse & soothing moisturizer',
      details: 'Remove sunscreen gently and apply a bland, fragrance-free ceramide moisturizer to intact surrounding skin.',
    },
    {
      id: 'evening-selfcheck',
      time: formatMinutes(sleepMin - 30),
      period: 'Night',
      category: 'Follow-Up & ABCDE Check',
      title: 'Log any visual changes & prepare for sleep',
      details: 'Note any new bleeding, crusting, itching, or growth in your ABCDE log. Aim for 7–9 hours of restorative sleep.',
    },
  ];

  let conditionGuidance = {
    mode: 'GENERAL_SAFE_GUIDANCE',
    headline: 'General Preventive Skin Health & Monitoring Guidance',
    reason: !predictedClass
      ? 'No active screening prediction selected. Displaying universal photoprotection and lesion monitoring guidance.'
      : 'Prediction confidence is below the 70% threshold. Disease-specific advice is withheld to avoid anchoring on an uncertain model output.',
    actionItems: [
      'Consult a qualified dermatologist for an authoritative in-person evaluation of any concerning lesion.',
      'Do not apply unprescribed acids, caustic pastes, or home remedies to undiagnosed lesions.',
      'Practice consistent daily broad-spectrum UV protection and record ABCDE observations.',
    ],
  };

  if (canUseDiseaseSpecific) {
    const map = {
      MEL: {
        headline: 'Priority Follow-Up Guidance (Predicted Class: MEL)',
        actionItems: [
          'Schedule an urgent in-person dermatologist appointment for dermoscopy and clinical evaluation.',
          'Avoid UV exposure on the lesion and document size/color changes photographically with a ruler.',
          'Do not delay professional assessment; early specialist review is critical.',
        ],
      },
      BCC: {
        headline: 'Prompt Clinical Evaluation Guidance (Predicted Class: BCC)',
        actionItems: [
          'Book a prompt dermatology appointment for biopsy assessment.',
          'Keep the area clean, protected from friction, and shielded from UV radiation.',
          'Never attempt self-removal or over-the-counter topical treatments.',
        ],
      },
      SCC: {
        headline: 'Prompt Clinical Evaluation Guidance (Predicted Class: SCC)',
        actionItems: [
          'Arrange timely dermatological evaluation, particularly if the lesion is tender, crusted, or growing.',
          'Protect fragile or hyperkeratotic skin from trauma and sun exposure.',
          'Never attempt self-treatment for suspected squamous cell lesions.',
        ],
      },
      ACK: {
        headline: 'Sun-Damage Care & Dermatology Review (Predicted Class: ACK)',
        actionItems: [
          'Schedule a dermatology visit to evaluate rough or scaly sun-damaged patches.',
          'Use daily SPF 50+ sunscreen and wide-brimmed hats to reduce ongoing actinic stress.',
          'Watch closely for thickening, tenderness, or bleeding that warrants earlier review.',
        ],
      },
      NEV: {
        headline: 'Ongoing ABCDE Surveillance Guidance (Predicted Class: NEV)',
        actionItems: [
          'Perform monthly self-examinations using the ABCDE criteria under consistent lighting.',
          'Remember that a benign AI screening prediction never guarantees a lesion is benign—consult a clinician if it changes.',
          'Maintain daily sun protection to prevent UV-induced mole changes.',
        ],
      },
      SEK: {
        headline: 'Gentle Care & Confirmation Guidance (Predicted Class: SEK)',
        actionItems: [
          'Avoid scratching or picking raised skin growths to prevent irritation or bleeding.',
          'Have any newly darkened, rapidly changing, or bleeding lesion checked by a dermatologist to rule out melanoma.',
          'Use gentle, fragrance-free skincare around raised areas.',
        ],
      },
    };
    const chosen = map[predictedClass];
    if (chosen) {
      conditionGuidance = {
        mode: 'CONDITION_SPECIFIC_GUIDANCE',
        headline: chosen.headline,
        reason: 'Screening confidence met the >=70% threshold. Guidance emphasizes professional follow-up and safe supportive habits.',
        actionItems: chosen.actionItems,
      };
    }
  }

  const weeklyDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weeklyPlan = weeklyDays.map((day, idx) => ({
    day,
    primaryFocus:
      idx === 0
        ? 'Weekly ABCDE Visual Check & Photo Log'
        : idx === 3
          ? 'Mid-Week Sunscreen Inventory & Hydration Check'
          : idx === 5
            ? 'Outdoor UV-Shielding & Hat/UPF Routine'
            : 'Daily Gentle Cleanse, SPF 30+ & Reapplication',
    tasks: [
      'Morning gentle cleanse + broad-spectrum SPF 30+',
      'Midday SPF reapplication (if outdoors)',
      idx === 0 ? 'Perform calm ABCDE observation under bright light' : 'Evening gentle cleanse + soothing moisturizer',
    ],
  }));

  return {
    generatedAt: new Date().toISOString(),
    wakeTime,
    sleepTime,
    canUseDiseaseSpecific,
    schedule,
    conditionGuidance,
    weeklyPlan,
  };
}
