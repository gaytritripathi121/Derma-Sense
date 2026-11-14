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
