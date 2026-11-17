import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePatientContext } from '../server/rules/ruleEngine.js';
import { generateSafeCornerPlan } from '../server/safeCorner/planner.js';

test('Independent patient-history rule engine triggers red-flag context rules', () => {
  const result = evaluatePatientContext({
    age: 67,
    fitzpatrickType: '1',
    region: 'FACE',
    diameterMm: 8,
    personalSkinCancerHistory: 'YES',
    changed: 'YES',
    bleed: 'YES',
    grew: 'YES',
  });

  assert.equal(result.contextualStatus, 'HIGH_CONTEXTUAL_ATTENTION');
  assert.ok(result.triggeredCount >= 4);
  assert.ok(result.triggeredFlags.some((f) => f.ruleId === 'RULE_MULTIPLE_CONCERNING_FEATURES'));
});

test('Safe Corner planner enforces 70% confidence gate on condition-specific advice', () => {
  const gatedPlan = generateSafeCornerPlan({
    predictedClass: 'MEL',
    isLowConfidence: true,
    patientHistory: { fitzpatrickType: '2' },
  });
  assert.equal(gatedPlan.canUseDiseaseSpecific, false);
  assert.equal(gatedPlan.conditionGuidance.mode, 'GENERAL_SAFE_GUIDANCE');

  const unlockedPlan = generateSafeCornerPlan({
    predictedClass: 'MEL',
    isLowConfidence: false,
    patientHistory: { fitzpatrickType: '2' },
  });
  assert.equal(unlockedPlan.canUseDiseaseSpecific, true);
  assert.equal(unlockedPlan.conditionGuidance.mode, 'CONDITION_SPECIFIC_GUIDANCE');
});

test('Safe Corner planner returns distinct educational guidance for all 6 categories', () => {
  const categories = ['ACK', 'BCC', 'MEL', 'NEV', 'SCC', 'SEK'];
  const overviews = new Set();

  for (const code of categories) {
    const plan = generateSafeCornerPlan({
      predictedClass: code,
      isLowConfidence: false,
      patientHistory: { fitzpatrickType: '3' },
    });

    assert.equal(plan.predictedClass, code);
    assert.equal(plan.isValidPrediction, true);
    assert.equal(plan.guidanceState, 'CATEGORY_GUIDANCE');
    assert.equal(plan.canUseDiseaseSpecific, true);
    assert.equal(plan.uncertaintyWarning, null);
    assert.equal(plan.conditionGuidance.mode, 'CONDITION_SPECIFIC_GUIDANCE');
    assert.equal(plan.educationalGuide.categoryCode, code);
    assert.ok(plan.educationalGuide.overview.length > 40);
    assert.ok(plan.educationalGuide.warningSigns.length >= 3);
    assert.ok(plan.educationalGuide.skinCareAdvice.length >= 3);
    assert.ok(plan.educationalGuide.whenToSeeDermatologist.length > 30);
    assert.ok(plan.educationalGuide.preventionAndSunProtection.length >= 3);
    assert.ok(plan.educationalGuide.dermatologistQuestions.length >= 3);
    assert.ok(plan.educationalGuide.medicalDisclaimer.includes('not a medical diagnostic tool'));
    overviews.add(plan.educationalGuide.overview);
  }

  assert.equal(overviews.size, 6);
});

test('Safe Corner planner returns uncertainty warning on low confidence and general fallback when unavailable or invalid', () => {
  const lowConf = generateSafeCornerPlan({
    predictedClass: 'NEV',
    isLowConfidence: true,
  });
  assert.equal(lowConf.canUseDiseaseSpecific, false);
  assert.equal(lowConf.guidanceState, 'LOW_CONFIDENCE_UNCERTAINTY');
  assert.equal(lowConf.conditionGuidance.mode, 'GENERAL_SAFE_GUIDANCE');
  assert.equal(lowConf.educationalGuide.categoryCode, null);
  assert.ok(lowConf.uncertaintyWarning);
  assert.ok(lowConf.uncertaintyWarning.title.includes('Low Prediction Confidence'));

  for (const badInput of [null, undefined, '', 'INVALID_CLASS']) {
    const fallback = generateSafeCornerPlan({
      predictedClass: badInput,
      isLowConfidence: false,
    });
    assert.equal(fallback.isValidPrediction, false);
    assert.equal(fallback.canUseDiseaseSpecific, false);
    assert.equal(fallback.guidanceState, 'GENERAL_UNAVAILABLE');
    assert.equal(fallback.uncertaintyWarning, null);
    assert.equal(fallback.conditionGuidance.mode, 'GENERAL_SAFE_GUIDANCE');
    assert.equal(fallback.educationalGuide.categoryCode, null);
    assert.ok(fallback.educationalGuide.warningSigns.length >= 3);
    assert.ok(fallback.educationalGuide.dermatologistQuestions.length >= 3);
  }
});
