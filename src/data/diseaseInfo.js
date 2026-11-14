export const DISEASE_INFO = {
  ACK: {
    code: 'ACK',
    fullName: 'Actinic Keratosis',
    group: 'Precancerous lesion',
    summary:
      'Actinic keratosis (solar keratosis) is a rough, scaly patch or bump on sun-exposed skin caused by cumulative ultraviolet (UV) radiation damage to epidermal keratinocytes.',
    characteristics: [
      'Rough, dry, or sandpaper-like scaly texture that may be easier to feel than see',
      'Commonly pink, red, skin-toned, or light brown, typically 2 mm to 6 mm initially',
      'Frequently located on chronically sun-exposed areas such as face, scalp, ears, neck, forearms, and dorsal hands',
      'May occasionally itch, burn, feel tender, or bleed slightly if scratched',
    ],
    riskInformation:
      'Actinic keratosis is considered a precancerous lesion. While individual lesions progress slowly, untreated actinic keratoses carry a recognized risk of progressing into invasive squamous cell carcinoma (SCC), and their presence indicates significant cumulative UV exposure.',
    urgencyGuidance:
      'Schedule a routine dermatological examination for clinical confirmation and discussion of management options, especially if a lesion thickens, grows rapidly, becomes painful, or bleeds.',
    suggestedNextSteps: [
      'Arrange an in-person skin check with a qualified dermatologist or primary care clinician.',
      'Protect sun-exposed skin daily with broad-spectrum SPF 30+ sunscreen and protective clothing.',
      'Monitor the lesion for induration (firm thickening), ulceration, bleeding, or rapid enlargement.',
    ],
    safeCornerFocus:
      'Prioritize strict daily UV protection, gentle non-abrasive cleansing, and regular photographic skin monitoring.',
    sources: [
      {
        name: 'American Academy of Dermatology (AAD) — Actinic Keratosis',
        url: 'https://www.aad.org/public/diseases/skin-cancer/actinic-keratosis-overview',
      },
      {
        name: 'National Cancer Institute (NCI) — Skin Cancer Prevention & Precancerous Conditions',
        url: 'https://www.cancer.gov/types/skin',
      },
    ],
  },
  BCC: {
    code: 'BCC',
    fullName: 'Basal Cell Carcinoma',
    group: 'Malignant skin cancer',
    summary:
      'Basal cell carcinoma is the most common form of skin cancer, arising from basal cells in the deepest layer of the epidermis, most frequently on chronically sun-exposed skin.',
    characteristics: [
      'Pearly, translucent, or waxy bump, often with visible fine surface blood vessels (telangiectasias)',
      'May present as a flat, firm, scar-like pale or pink plaque or a persistent non-healing sore',
      'Central ulceration, crusting, oozing, or recurrent spontaneous bleeding followed by temporary healing',
      'Rolled or slightly elevated border with a depressed center in nodular presentations',
    ],
    riskInformation:
      'Basal cell carcinoma rarely metastasizes to distant organs, but it is a locally invasive malignancy that can cause substantial local tissue destruction if left untreated, particularly on the face, eyelids, nose, or ears.',
    urgencyGuidance:
      'Prompt dermatological evaluation is strongly recommended for dermoscopy and biopsy assessment. Do not attempt home remedies or self-treatment.',
    suggestedNextSteps: [
      'Book an appointment with a board-certified dermatologist promptly for clinical examination and biopsy evaluation.',
      'Do not pick, scratch, or apply over-the-counter caustic or herbal agents to the lesion.',
      'Bring notes on lesion duration, bleeding episodes, and personal/family skin cancer history to your visit.',
    ],
    safeCornerFocus:
      'Prompt clinical follow-up scheduling, gentle area protection without irritation, and consistent UV shielding.',
    sources: [
      {
        name: 'American Cancer Society (ACS) — Basal and Squamous Cell Skin Cancer',
        url: 'https://www.cancer.org/cancer/types/basal-and-squamous-cell-skin-cancer.html',
      },
      {
        name: 'American Academy of Dermatology (AAD) — Basal Cell Carcinoma',
        url: 'https://www.aad.org/public/diseases/skin-cancer/types/common/bcc',
      },
    ],
  },
  MEL: {
    code: 'MEL',
    fullName: 'Melanoma',
    group: 'Malignant skin cancer',
    summary:
      'Melanoma is a serious malignancy of pigment-producing melanocytes. Early clinical detection and histopathological staging strongly influence outcomes.',
    characteristics: [
      'Often exhibits ABCDE warning signs: Asymmetry, irregular Borders, multiple Colors, Diameter often > 6 mm, and Evolving appearance',
      'Variegated pigmentation combining shades of brown, black, tan, red, white, or blue',
      'Can arise within an existing nevus or appear as a new pigmented or occasionally amelanotic lesion',
      'May show recent change in size, shape, elevation, itching, crusting, or bleeding',
    ],
    riskInformation:
      'Melanoma accounts for the majority of skin-cancer-related mortality because of its potential to invade deeper dermal layers and metastasize if not diagnosed and excised early.',
    urgencyGuidance:
      'Seek prompt in-person evaluation by a dermatologist as soon as possible. Any evolving pigmented lesion or lesion with bleeding/ulceration requires urgent professional assessment.',
    suggestedNextSteps: [
      'Schedule an urgent appointment with a dermatologist for full-body skin examination and dermoscopy.',
      'Avoid delaying evaluation regardless of AI confidence scores; only clinical biopsy confirms or excludes melanoma.',
      'Document any timeline of changes in size, color, or symptoms to share with your physician.',
    ],
    safeCornerFocus:
      'Immediate clinical appointment tracking, photographic change logging without delay, and comprehensive sun safety.',
    sources: [
      {
        name: 'National Cancer Institute (NCI) — Melanoma Treatment & Overview',
        url: 'https://www.cancer.gov/types/skin/patient/melanoma-treatment-pdq',
      },
      {
        name: 'NHS — Melanoma Skin Cancer',
        url: 'https://www.nhs.uk/conditions/melanoma-skin-cancer/',
      },
    ],
  },
  NEV: {
    code: 'NEV',
    fullName: 'Melanocytic Nevus',
    group: 'Benign melanocytic lesion',
    summary:
      'A melanocytic nevus (common mole) is a benign proliferation of melanocytes in the skin, typically uniform in color and border.',
    characteristics: [
      'Usually symmetric round or oval shape with well-demarcated, smooth borders',
      'Even coloration across tan, brown, or skin-toned shades',
      'Typically under 6 mm in diameter and stable in size and appearance over time',
      'May be flat (junctional) or smoothly raised (compound or intradermal)',
    ],
    riskInformation:
      'Common nevi are benign. However, atypical nevi and early melanomas can closely resemble benign moles on casual smartphone photographs. A benign-looking prediction never rules out malignancy.',
    urgencyGuidance:
      'Continue periodic self-monitoring using the ABCDE criteria. Consult a dermatologist if the lesion changes in size, shape, color, becomes symptomatic, or differs from your other moles ("ugly duckling" sign).',
    suggestedNextSteps: [
      'Monitor periodically with consistent lighting and a ruler reference for any evolving features.',
      'Seek dermatological review promptly if new symptoms (bleeding, persistent itch, rapid growth) or ABCDE changes appear.',
      'Maintain daily broad-spectrum sun protection and routine preventive skin checks.',
    ],
    safeCornerFocus:
      'Consistent UV protection, gentle daily skincare, and periodic ABCDE self-monitoring.',
    sources: [
      {
        name: 'American Academy of Dermatology (AAD) — Moles: Overview',
        url: 'https://www.aad.org/public/diseases/a-z/moles-overview',
      },
      {
        name: 'National Cancer Institute (NCI) — Common Moles, Dysplastic Nevi, and Risk of Melanoma',
        url: 'https://www.cancer.gov/types/skin/moles-fact-sheet',
      },
    ],
  },
  SCC: {
    code: 'SCC',
    fullName: 'Squamous Cell Carcinoma (including Bowen’s Disease)',
    group: 'Malignant skin cancer',
    summary:
      'Cutaneous squamous cell carcinoma is the second most common skin cancer, arising from epidermal squamous cells. In PAD-UFES-20, Bowen’s disease (squamous cell carcinoma in situ) is grouped within the SCC category.',
    characteristics: [
      'Firm, red nodule, scaly crusted plaque, or hyperkeratotic wart-like growth',
      'Bowen’s disease (SCC in situ) often appears as a persistent, slowly enlarging red scaly patch',
      'Frequently tender or painful to touch, and prone to surface crusting, ulceration, or bleeding',
      'Commonly develops on sun-damaged areas such as face, lips, ears, scalp, neck, and hands',
    ],
    riskInformation:
      'Invasive squamous cell carcinoma can grow deep into surrounding tissues and carries a risk of metastasis if neglected, particularly on high-risk sites (lips, ears, immunosuppressed patients).',
    urgencyGuidance:
      'Prompt dermatological evaluation is strongly advised for clinical examination and possible biopsy. Do not attempt topical home treatments.',
    suggestedNextSteps: [
      'Schedule a timely in-person evaluation with a dermatologist.',
      'Protect the area from trauma and UV exposure while awaiting medical assessment.',
      'Share details regarding lesion tenderness, growth rate, and prior sunburns or actinic keratoses.',
    ],
    safeCornerFocus:
      'Timely specialist scheduling, gentle protection of fragile skin, and strict daily photoprotection.',
    sources: [
      {
        name: 'American Cancer Society (ACS) — Basal and Squamous Cell Skin Cancer',
        url: 'https://www.cancer.org/cancer/types/basal-and-squamous-cell-skin-cancer.html',
      },
      {
        name: 'NHS — Non-melanoma Skin Cancer',
        url: 'https://www.nhs.uk/conditions/non-melanoma-skin-cancer/',
      },
    ],
  },
  SEK: {
    code: 'SEK',
    fullName: 'Seborrheic Keratosis',
    group: 'Benign epidermal lesion',
    summary:
      'Seborrheic keratosis is a very common, benign epidermal skin growth that often increases in prevalence with age and is not caused by malignancy.',
    characteristics: [
      'Well-circumscribed, slightly raised plaque or papule with a classic "stuck-on" appearance',
      'Waxy, verrucous (warty), or finely fissured surface, ranging from light tan to dark brown or black',
      'May show horn cysts or comedo-like surface openings on close inspection',
      'Usually painless, though friction from clothing can occasionally cause mild irritation',
    ],
    riskInformation:
      'Seborrheic keratoses are benign. However, darkly pigmented or irritated seborrheic keratoses can clinically mimic melanoma or pigmented basal cell carcinoma, so new or changing dark lesions warrant professional inspection.',
    urgencyGuidance:
      'If a lesion has appeared suddenly, changed color or size, bled without trauma, or looks atypical compared to surrounding lesions, consult a dermatologist to confirm it is benign.',
    suggestedNextSteps: [
      'Do not pick or scratch raised lesions to avoid secondary infection or bleeding.',
      'Have any newly darkened, rapidly changing, or bleeding growth evaluated by a clinician to exclude melanoma.',
      'Follow gentle cleansing and non-irritating skincare habits.',
    ],
    safeCornerFocus:
      'Friction-free gentle skincare, avoiding picking, and routine ABCDE observation.',
    sources: [
      {
        name: 'American Academy of Dermatology (AAD) — Seborrheic Keratoses',
        url: 'https://www.aad.org/public/diseases/a-z/seborrheic-keratoses-overview',
      },
      {
        name: 'NHS — Seborrhoeic Keratosis',
        url: 'https://www.nhs.uk/conditions/seborrhoeic-keratosis/',
      },
    ],
  },
};
