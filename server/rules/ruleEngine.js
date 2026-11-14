import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesPath = path.join(__dirname, 'rules.json');

export function loadRules() {
  const raw = fs.readFileSync(rulesPath, 'utf8');
  return JSON.parse(raw);
}

export function evaluatePatientContext(patientHistory = {}) {
  const rules = loadRules();
  const triggeredFlags = [];

  for (const rule of rules) {
    const rawVal = patientHistory[rule.field];
    let matched = false;

    if (rawVal === undefined || rawVal === null || rawVal === '' || rawVal === 'UNKNOWN') {
      continue;
    }

    if (rule.operator === 'GTE') {
      const num = Number(rawVal);
      if (!Number.isNaN(num) && num >= Number(rule.value)) {
        matched = true;
      }
    } else if (rule.operator === 'IN') {
      const normalized = String(rawVal).toUpperCase();
      if (Array.isArray(rule.value) && rule.value.map((v) => String(v).toUpperCase()).includes(normalized)) {
        matched = true;
      }
    } else if (String(rawVal).toUpperCase() === String(rule.expected).toUpperCase()) {
      matched = true;
    }

    if (matched) {
      triggeredFlags.push({
        ruleId: rule.ruleId,
        title: rule.title,
        severity: rule.severity,
        inputsUsed: { [rule.field]: rawVal },
        explanation: rule.explanation,
        suggestedNextStep: rule.suggestedNextStep,
      });
    }
  }

  const highCount = triggeredFlags.filter((f) => f.severity === 'HIGH_ATTENTION').length;
  const modCount = triggeredFlags.filter((f) => f.severity === 'MODERATE_ATTENTION').length;

  if (highCount >= 2 || (highCount >= 1 && modCount >= 2)) {
    triggeredFlags.unshift({
      ruleId: 'RULE_MULTIPLE_CONCERNING_FEATURES',
      title: 'Multiple Concurrent Clinical Attention Factors',
      severity: 'HIGH_ATTENTION',
      inputsUsed: { highAttentionCount: highCount, moderateAttentionCount: modCount },
      explanation:
        'Multiple patient-reported risk or symptom flags are simultaneously present. Combined warning signs increase the importance of timely professional dermatological assessment.',
      suggestedNextStep:
        'Prioritize an in-person dermatologist appointment promptly regardless of AI image confidence.',
    });
  }

  let contextualStatus = 'NO_ELEVATED_FLAGS';
  let contextualStatusLabel = 'No Elevated Contextual Flags Reported';
  let overallRecommendation =
    'No specific self-reported red-flag symptoms were triggered. Continue routine skin self-monitoring and seek medical care if any new changes develop.';

  if (highCount >= 1) {
    contextualStatus = 'HIGH_CONTEXTUAL_ATTENTION';
    contextualStatusLabel = 'High Contextual Attention — Prompt Clinical Review Advised';
    overallRecommendation =
      'One or more high-attention clinical history factors were reported (e.g., changing lesion, bleeding, growth, or prior skin cancer). Consult a qualified dermatologist promptly.';
  } else if (modCount >= 1) {
    contextualStatus = 'MODERATE_CONTEXTUAL_ATTENTION';
    contextualStatusLabel = 'Moderate Contextual Attention — Dermatological Check Recommended';
    overallRecommendation =
      'Moderate contextual factors were reported. Schedule a routine clinical skin check and monitor the lesion carefully.';
  } else if (triggeredFlags.length > 0) {
    contextualStatus = 'INFORMATIONAL_CONTEXT';
    contextualStatusLabel = 'Informational Risk Context Noted';
    overallRecommendation =
      'Baseline phototype, anatomical site, or age context was recorded. Maintain daily sun protection and periodic skin exams.';
  }

  return {
    engineType: 'Independent Heuristic Rule Engine (JSON Knowledge Base)',
    disclaimer:
      'Contextual flags are heuristic observations based on patient-reported inputs and general dermatology screening guidance. They are NOT a clinically validated risk score, NOT SHAP values, and do NOT alter the CNN image prediction.',
    contextualStatus,
    contextualStatusLabel,
    overallRecommendation,
    triggeredCount: triggeredFlags.length,
    triggeredFlags,
  };
}
