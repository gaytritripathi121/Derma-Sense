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

const VALID_CATEGORIES = ['ACK', 'BCC', 'MEL', 'NEV', 'SCC', 'SEK'];

const MEDICAL_DISCLAIMER =
  'Educational Screening Notice: DermaSense AI provides educational skin-health awareness only and is not a medical diagnostic tool. Automated screening predictions are never a confirmed diagnosis, never establish that a lesion is harmless, and do not replace an in-person dermatological examination or biopsy.';

const CATEGORY_GUIDES = {
  ACK: {
    categoryCode: 'ACK',
    categoryName: 'Actinic Keratosis',
    categoryGroup: 'Precancerous sun-damaged lesion',
    urgencyLevel: 'Routine to prompt dermatology review',
    headline: 'Sun-Damage Care & Dermatology Review — Actinic Keratosis (ACK)',
    overview:
      'In dermatology, actinic keratosis (solar keratosis) refers to a rough, scaly patch or dry bump on chronically sun-exposed skin caused by cumulative ultraviolet (UV) injury to surface skin cells. Because some untreated actinic keratoses can progress over time, clinical evaluation helps confirm what the spot is and guide appropriate care.',
    warningSigns: [
      'Firm thickening or hardening (induration) at the base of a scaly patch',
      'Rapid enlargement, raised horn-like crusting, or persistent tenderness to touch',
      'Spontaneous bleeding, oozing, or an open sore that fails to heal',
      'Surrounding redness or inflammation that persists over several weeks',
    ],
    skinCareAdvice: [
      'Wash sun-exposed skin gently with lukewarm water and a mild, fragrance-free cleanser.',
      'Avoid scrubbing, picking, peeling dry scales, or using harsh chemical exfoliants over rough patches.',
      'Apply a bland, non-irritating moisturizer to intact surrounding skin to reduce surface dryness.',
      'Never apply unprescribed acids, caustic pastes, or over-the-counter spot removers.',
    ],
    whenToSeeDermatologist:
      'Schedule an in-person dermatology skin exam to confirm whether a rough patch is actinic keratosis or another condition. Seek prompt evaluation if the area thickens, becomes painful or tender, bleeds easily, or develops a persistent crust.',
    preventionAndSunProtection: [
      'Apply broad-spectrum SPF 50+ sunscreen daily (mineral zinc-oxide or titanium-dioxide formulas are gentle on sensitive sun-damaged skin).',
      'Reapply sunscreen every 2 hours outdoors and pay close attention to high-UV zones: face, scalp, ears, neck, forearms, and backs of hands.',
      'Wear wide-brimmed hats, UV-filtering sunglasses, and tightly woven UPF clothing, and seek shade between 10:00 AM and 4:00 PM.',
    ],
    dermatologistQuestions: [
      'Could this rough patch be an actinic keratosis or something else that needs dermoscopy or a biopsy?',
      'How long have I noticed this spot, and should nearby sun-damaged skin also be checked?',
      'What clinical evaluation or follow-up skin-check schedule do you recommend for my sun exposure history?',
      'Which daily sunscreen and gentle skin-care habits best suit my skin type?',
    ],
    actionItems: [
      'Schedule a dermatology visit to evaluate rough or scaly sun-damaged patches.',
      'Use daily broad-spectrum SPF 50+ sunscreen and wide-brimmed hats to reduce ongoing UV stress.',
      'Watch closely for thickening, tenderness, or bleeding that warrants earlier review.',
    ],
  },
  BCC: {
    categoryCode: 'BCC',
    categoryName: 'Basal Cell Carcinoma',
    categoryGroup: 'Malignant skin cancer category',
    urgencyLevel: 'Prompt dermatology evaluation recommended',
    headline: 'Prompt Clinical Evaluation Guidance — Basal Cell Carcinoma (BCC)',
    overview:
      'Basal cell carcinoma is the most common skin cancer category, arising from basal cells in the lower epidermis—frequently on chronically sun-exposed skin such as the face, ears, neck, or shoulders. Although it rarely spreads to distant organs, untreated lesions can gradually invade local tissue, so professional assessment is important.',
    warningSigns: [
      'A non-healing sore that crusts, bleeds, seems to improve temporarily, and then reopens',
      'A pearly, translucent, or waxy bump with fine visible surface blood vessels',
      'A firm, flat, pale or scar-like patch with poorly defined borders',
      'A slightly raised, rolled border around a central depression or small ulcer',
    ],
    skinCareAdvice: [
      'Cleanse the area gently with lukewarm water and a mild non-soap cleanser, then pat dry carefully without rubbing.',
      'Protect fragile or oozing areas from friction (such as eyeglasses, collars, or straps) with a clean non-stick dressing if needed.',
      'Do not squeeze, pick crusts, shave directly over the bump, or apply home remedies or caustic topical creams.',
    ],
    whenToSeeDermatologist:
      'Arrange a prompt appointment with a qualified dermatologist for dermoscopic examination and possible diagnostic biopsy—especially for any non-healing sore, pearly bump, or recurrently bleeding spot on the face, nose, eyelids, or ears.',
    preventionAndSunProtection: [
      'Use broad-spectrum SPF 30+ to SPF 50+ sunscreen every morning on exposed skin and reapply every 2 hours outdoors.',
      'Combine sunscreen with wide-brimmed hats, UV-blocking sunglasses, and shade during peak midday UV hours.',
      'Maintain regular full-body skin exams, as prior sun damage in one area can coincide with new lesions elsewhere.',
    ],
    dermatologistQuestions: [
      'I noticed a spot that crusts, bleeds, or has not healed—does it need dermoscopy or a skin biopsy?',
      'What timeline of bleeding, oozing, or growth is most helpful for my clinical record?',
      'How should I safely cover or cleanse this area while awaiting clinical evaluation?',
      'How frequently should I return for routine full-skin surveillance?',
    ],
    actionItems: [
      'Book a prompt dermatology appointment for clinical examination and biopsy assessment.',
      'Keep the area clean, protected from friction, and shielded from UV radiation.',
      'Never attempt self-removal or over-the-counter topical treatments.',
    ],
  },
  MEL: {
    categoryCode: 'MEL',
    categoryName: 'Melanoma',
    categoryGroup: 'Serious pigment-cell skin cancer category',
    urgencyLevel: 'Priority / urgent dermatology evaluation advised',
    headline: 'Priority Follow-Up Guidance — Melanoma (MEL)',
    overview:
      'Melanoma is a serious malignancy of pigment-producing melanocytes where early clinical detection strongly influences outcomes. Only a qualified physician using clinical examination, dermoscopy, and histopathology can diagnose or rule out melanoma; an automated screening category is strictly an educational prompt for professional review.',
    warningSigns: [
      'Asymmetry: one half of the pigmented spot does not match the other half',
      'Border irregularity: scalloped, notched, ragged, or poorly defined outer edges',
      'Color variation: multiple shades of brown, black, tan, red, white, or blue within one lesion',
      'Diameter larger than 6 mm (though early melanomas can be smaller) or any Evolution in size, shape, elevation, itch, or bleeding',
      '"Ugly duckling" appearance: a spot that looks noticeably different from your surrounding moles',
    ],
    skinCareAdvice: [
      'Leave the lesion undisturbed: never scratch, pick, peel, shave over, or apply exfoliants, lightening agents, or OTC mole removers.',
      'Wash gently with mild cleanser and lukewarm water and protect the spot from direct sun or physical irritation.',
      'Take a clear reference photograph beside a millimeter ruler in steady lighting so you can share exact changes with your clinician.',
    ],
    whenToSeeDermatologist:
      'Seek prompt, priority in-person evaluation from a board-certified dermatologist without delay. Any evolving pigmented lesion, new adult dark spot, or bleeding/ulcerated lesion requires timely medical assessment regardless of any model output.',
    preventionAndSunProtection: [
      'Practice strict daily photoprotection using broad-spectrum SPF 50+ sunscreen, UPF-rated clothing, and wide-brimmed hats.',
      'Avoid peak midday sun (10:00 AM–4:00 PM) and completely avoid indoor UV tanning devices.',
      'Ask your dermatologist whether baseline skin mapping or regular periodic full-body exams are recommended for your risk profile.',
    ],
    dermatologistQuestions: [
      'Can we examine this lesion with dermoscopy and evaluate whether an excisional biopsy is needed?',
      'Here is when I first noticed the spot and how its color, border, or size has changed—what else should be checked in a full-body exam?',
      'Given my personal or family history of skin cancer or atypical moles, how often should I schedule skin checks?',
      'What specific changes between visits should prompt an immediate return?',
    ],
    actionItems: [
      'Schedule an urgent in-person dermatologist appointment for dermoscopy and clinical evaluation.',
      'Avoid UV exposure on the lesion and document size or color changes photographically with a ruler.',
      'Do not delay professional assessment; early specialist review is critical.',
    ],
  },
  NEV: {
    categoryCode: 'NEV',
    categoryName: 'Melanocytic Nevus',
    categoryGroup: 'Benign melanocytic mole category (requires cautious monitoring)',
    urgencyLevel: 'Routine monitoring; prompt exam if changing or symptomatic',
    headline: 'Ongoing ABCDE Surveillance Guidance — Melanocytic Nevus (NEV)',
    overview:
      'A melanocytic nevus (common mole) is typically a benign cluster of pigment-producing cells with relatively even color and smooth borders. Importantly, early melanomas and atypical moles can closely resemble common moles in smartphone photographs, so a NEV prediction never confirms a lesion is harmless or rules out skin cancer.',
    warningSigns: [
      'Any new ABCDE sign: Asymmetry, irregular Borders, multi-toned Color, Diameter growth (>6 mm), or Evolving appearance',
      'A mole that stands out visually from your other moles ("ugly duckling" sign)',
      'New itching, pain, tenderness, crusting, oozing, or spontaneous bleeding',
      'A newly appearing pigmented spot in adulthood that continues to enlarge or darken',
    ],
    skinCareAdvice: [
      'Cleanse normally with a mild, pH-balanced cleanser and keep surrounding skin hydrated with gentle, fragrance-free lotion.',
      'Avoid picking, scratching, or nicking raised moles while shaving or under tight clothing straps.',
      'Never use at-home mole-removal creams, acids, or sharp tools—only a clinician should remove or biopsy a mole.',
    ],
    whenToSeeDermatologist:
      'Consult a dermatologist promptly if the spot changes in size, shape, color, or elevation, develops itching or bleeding, appeared newly after age 30, or raises any clinical concern—even if an automated screening model predicted NEV.',
    preventionAndSunProtection: [
      'Apply broad-spectrum SPF 30+ (or SPF 50+ for fair/UV-sensitive skin) daily to protect melanocytes from cumulative UV stress.',
      'Use hats, shade, and UPF clothing during extended outdoor activity and avoid sunburns and tanning beds.',
      'Perform calm monthly self-skin checks in consistent bright lighting, using a hand mirror for back and scalp areas.',
    ],
    dermatologistQuestions: [
      'On dermoscopy, does this mole look reassuringly uniform, or does it have any atypical features worth monitoring or biopsying?',
      'Is this a stable long-standing mole or a newer lesion, and how does it compare with my other moles?',
      'Should I have a baseline full-body skin exam based on my total mole count and family history?',
      'What specific ABCDE changes should trigger an earlier appointment?',
    ],
    actionItems: [
      'Perform periodic self-examinations using the ABCDE criteria under consistent lighting.',
      'Remember that a NEV screening prediction never guarantees a lesion is harmless—consult a clinician if it changes or worries you.',
      'Maintain daily broad-spectrum sun protection to reduce UV-induced mole changes.',
    ],
  },
  SCC: {
    categoryCode: 'SCC',
    categoryName: 'Squamous Cell Carcinoma (including Bowen’s Disease)',
    categoryGroup: 'Malignant skin cancer category',
    urgencyLevel: 'Prompt dermatology evaluation recommended',
    headline: 'Prompt Clinical Evaluation Guidance — Squamous Cell Carcinoma (SCC)',
    overview:
      'Cutaneous squamous cell carcinoma arises from squamous cells in the outer epidermis; in PAD-UFES-20, this category also includes Bowen’s disease (squamous cell carcinoma in situ), which often looks like a persistent scaly red patch. Because invasive SCC can grow deeper and carry spread risk if neglected, prompt professional diagnosis is essential.',
    warningSigns: [
      'A firm, growing pink or red nodule, scaly crusted plaque, or rough wart-like bump',
      'A persistent, slowly enlarging red scaly patch that does not resolve with moisturizers (possible Bowen’s disease appearance)',
      'Marked tenderness or pain when touched, central ulceration, crusting, or easy bleeding',
      'Rapidly enlarging or firm lesions on high-risk sun-exposed sites such as lips, ears, face, scalp, neck, or dorsal hands',
    ],
    skinCareAdvice: [
      'Do not pick, scrape, or peel hyperkeratotic crusts; cleanse gently with lukewarm water and pat dry softly.',
      'Protect tender or fragile skin from bumping, sun exposure, and friction (a clean non-stick dressing can cushion fragile spots).',
      'Avoid harsh exfoliants, salicylic wart acids, or unprescribed topical creams on persistent scaly plaques.',
    ],
    whenToSeeDermatologist:
      'Schedule a prompt in-person evaluation with a dermatologist for dermoscopy and possible biopsy—especially if the spot is tender, crusted, growing, ulcerated, or located on the lips, ears, or in an immunocompromised person.',
    preventionAndSunProtection: [
      'Apply broad-spectrum SPF 50+ sunscreen daily (plus SPF lip balm for sun-exposed lips) and reapply every 2 hours outdoors.',
      'Wear wide-brimmed hats that shade the ears, face, and neck along with long-sleeved UPF garments during outdoor work or recreation.',
      'Check surrounding sun-damaged skin regularly for rough actinic spots and avoid tanning beds.',
    ],
    dermatologistQuestions: [
      'Could this scaly plaque or firm nodule be squamous cell carcinoma, Bowen’s disease, or another condition requiring a biopsy?',
      'Are there any high-risk features given its location, tenderness, or growth rate?',
      'Should adjacent sun-damaged areas (such as scalp, ears, lips, or forearms) be examined at the same visit?',
      'What follow-up schedule is appropriate after clinical assessment?',
    ],
    actionItems: [
      'Arrange timely dermatological evaluation, particularly if the lesion is tender, crusted, or growing.',
      'Protect fragile or hyperkeratotic skin from trauma and UV exposure.',
      'Never attempt self-treatment for persistent scaly nodules or plaques.',
    ],
  },
  SEK: {
    categoryCode: 'SEK',
    categoryName: 'Seborrheic Keratosis',
    categoryGroup: 'Benign epidermal growth category (can mimic pigmented cancers)',
    urgencyLevel: 'Routine clinical confirmation; prompt exam if dark, changing, or bleeding',
    headline: 'Gentle Care & Clinical Confirmation Guidance — Seborrheic Keratosis (SEK)',
    overview:
      'Seborrheic keratosis is a very common, benign epidermal growth that often develops with age and has a waxy, warty, or "stuck-on" texture. Crucially, darkly pigmented or irritated seborrheic keratoses can look remarkably similar to melanoma or pigmented basal cell carcinoma in photographs, so an AI SEK prediction never proves a growth is harmless.',
    warningSigns: [
      'Sudden darkening, uneven black/blue/red coloration, or irregular notched borders',
      'Spontaneous bleeding, persistent oozing, or ulceration not caused by snagging on clothing',
      'Rapid enlargement or appearance of an atypical "ugly duckling" dark growth unlike other spots',
      'Chronic inflammation, pain, or uncertainty about whether a dark spot is truly a seborrheic keratosis',
    ],
    skinCareAdvice: [
      'Do not pick, scratch, or try to peel off waxy growths—trauma leads to bleeding, swelling, and secondary skin infection.',
      'Wear soft, loose-fitting fabrics over raised growths to reduce chafing and snagging; cleanse gently with mild cleanser.',
      'Never use over-the-counter wart removers, freezing kits, or caustic pastes on an unconfirmed pigmented lesion.',
    ],
    whenToSeeDermatologist:
      'See a dermatologist for in-person dermoscopic confirmation if a pigmented or raised growth appeared recently, changed in color or size, bled spontaneously, or looks distinct from other growths—because only a clinician can distinguish a benign keratosis from melanoma.',
    preventionAndSunProtection: [
      'Even though seborrheic keratoses are benign growths, daily broad-spectrum SPF 30+ sunscreen protects surrounding skin from UV-driven cancers.',
      'Keep skin hydrated with gentle, fragrance-free moisturizers to minimize dryness and itching around raised plaques.',
      'Monitor dark spots periodically in good light so any atypical evolution is caught early.',
    ],
    dermatologistQuestions: [
      'Can you confirm with dermoscopy that this pigmented or waxy growth is a benign seborrheic keratosis and not melanoma or pigmented BCC?',
      'Is any change I noticed caused by routine clothing friction, or does it warrant a biopsy?',
      'What safe, gentle ways can I protect raised growths from catching on jewelry or clothing?',
      'If confirmed benign and irritated by friction, what safe in-office options exist?',
    ],
    actionItems: [
      'Avoid scratching or picking raised skin growths to prevent irritation or bleeding.',
      'Have any newly darkened, rapidly changing, or bleeding lesion checked by a dermatologist to rule out melanoma.',
      'Use gentle, fragrance-free skincare around raised areas.',
    ],
  },
};

const GENERAL_GUIDE = {
  categoryCode: null,
  categoryName: 'General Skin-Health & Preventive Awareness',
  categoryGroup: 'Universal non-diagnostic educational guidance',
  urgencyLevel: 'Consult a dermatologist for any new, changing, or concerning spot',
  headline: 'General Preventive Skin Health & Monitoring Guidance',
  overview:
    'Because no reliable category-specific screening result is currently active, DermaSense AI provides universal evidence-aligned skin-health habits, sun protection practices, and clinical warning signs. Visual self-monitoring paired with professional dermatological care remains the safest path for evaluating any skin concern.',
  warningSigns: [
    'ABCDE warning signs on pigmented spots: Asymmetry, irregular Borders, multiple Colors, Diameter > 6 mm, or Evolving appearance',
    'Any persistent sore or scaly patch that crusts, oozes, bleeds easily, or fails to heal over several weeks',
    'A firm, growing pink/red nodule or pearly bump, especially on sun-exposed head, neck, arms, or hands',
    'New pain, tenderness, persistent itching, or a lesion that stands out from your other spots ("ugly duckling" sign)',
  ],
  skinCareAdvice: [
    'Cleanse gently with lukewarm water and a mild, fragrance-free, pH-balanced cleanser rather than abrasive scrubs.',
    'Keep intact surrounding skin moisturized with bland ceramide or petrolatum-based lotions to support skin barrier comfort.',
    'Do not pick, squeeze, scratch, or apply unprescribed acids, herbal escharotics, or OTC mole/wart removers to undiagnosed spots.',
  ],
  whenToSeeDermatologist:
    'Schedule an in-person dermatological examination whenever you notice a new adult skin growth, any changing or bleeding lesion, a persistent rough/scaly patch, or whenever a screening check produces uncertain confidence.',
  preventionAndSunProtection: [
    'Apply broad-spectrum SPF 30+ (or SPF 50+ for fair/sun-sensitive skin) every morning to exposed skin and reapply every 2 hours outdoors.',
    'Seek shade between 10:00 AM and 4:00 PM, wear wide-brimmed hats and UPF-rated clothing, and avoid indoor tanning beds.',
    'Perform calm monthly head-to-toe skin checks in bright light and log observations in the ABCDE tracker.',
  ],
  dermatologistQuestions: [
    'I noticed a skin spot with these visual features and duration—should it be evaluated with dermoscopy or a biopsy?',
    'Given my skin phototype, sun exposure history, and family history, how often should I schedule full-body skin exams?',
    'Are there specific sunscreens or gentle skincare habits you recommend for my skin?',
    'Which changes between visits should prompt an earlier follow-up?',
  ],
  actionItems: [
    'Consult a qualified dermatologist for an authoritative in-person evaluation of any concerning lesion.',
    'Do not apply unprescribed acids, caustic pastes, or home remedies to undiagnosed lesions.',
    'Practice consistent daily broad-spectrum UV protection and record ABCDE observations.',
  ],
};

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

  const normalizedClass =
    typeof predictedClass === 'string' && VALID_CATEGORIES.includes(predictedClass.trim().toUpperCase())
      ? predictedClass.trim().toUpperCase()
      : null;

  const isValidPrediction = Boolean(normalizedClass);
  const canUseDiseaseSpecific = Boolean(isValidPrediction && !isLowConfidence);

  let guidanceState = 'GENERAL_UNAVAILABLE';
  if (isValidPrediction && isLowConfidence) {
    guidanceState = 'LOW_CONFIDENCE_UNCERTAINTY';
  } else if (canUseDiseaseSpecific) {
    guidanceState = 'CATEGORY_GUIDANCE';
  }

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

  const selectedGuide = canUseDiseaseSpecific ? CATEGORY_GUIDES[normalizedClass] : GENERAL_GUIDE;

  const uncertaintyWarning =
    guidanceState === 'LOW_CONFIDENCE_UNCERTAINTY'
      ? {
          title: 'Low Prediction Confidence — Do Not Rely on This Screening Output',
          message: `The screening model's confidence for tentative category ${normalizedClass} fell below the 70.0% reliability threshold (or showed high uncertainty). This output must not be treated as reliable or used for self-triage.`,
          recommendation:
            'Condition-specific guidance is withheld to avoid false reassurance or premature anchoring. General skin-health guidance is displayed below, and an in-person assessment by a qualified dermatologist is strongly recommended.',
        }
      : null;

  let reason;
  if (guidanceState === 'CATEGORY_GUIDANCE') {
    reason = `Educational guidance tailored to predicted screening category ${normalizedClass} (${selectedGuide.categoryName}). Screening confidence met the 70.0% threshold, though this remains educational awareness only and is not a confirmed medical diagnosis.`;
  } else if (guidanceState === 'LOW_CONFIDENCE_UNCERTAINTY') {
    reason =
      'Prediction confidence is below the 70% threshold. Disease-specific advice is withheld to avoid anchoring on an uncertain model output; general skin-health guidance is provided instead.';
  } else {
    reason =
      'No valid active screening prediction selected. Displaying general skin-health, sun protection, and dermatological monitoring guidance.';
  }

  const conditionGuidance = {
    mode: canUseDiseaseSpecific ? 'CONDITION_SPECIFIC_GUIDANCE' : 'GENERAL_SAFE_GUIDANCE',
    headline: selectedGuide.headline,
    reason,
    actionItems: selectedGuide.actionItems,
  };

  const educationalGuide = {
    mode: conditionGuidance.mode,
    guidanceState,
    categoryCode: canUseDiseaseSpecific ? selectedGuide.categoryCode : null,
    categoryName: selectedGuide.categoryName,
    categoryGroup: selectedGuide.categoryGroup,
    urgencyLevel: selectedGuide.urgencyLevel,
    overview: selectedGuide.overview,
    warningSigns: selectedGuide.warningSigns,
    skinCareAdvice: selectedGuide.skinCareAdvice,
    whenToSeeDermatologist: selectedGuide.whenToSeeDermatologist,
    preventionAndSunProtection: selectedGuide.preventionAndSunProtection,
    dermatologistQuestions: selectedGuide.dermatologistQuestions,
    medicalDisclaimer: MEDICAL_DISCLAIMER,
  };

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
    predictedClass: normalizedClass,
    isValidPrediction,
    isLowConfidence: Boolean(isLowConfidence),
    guidanceState,
    canUseDiseaseSpecific,
    uncertaintyWarning,
    educationalGuide,
    schedule,
    conditionGuidance,
    weeklyPlan,
  };
}
