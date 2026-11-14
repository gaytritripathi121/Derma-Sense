import test from 'node:test';
import assert from 'node:assert/strict';
import { createPatientLesionSplits } from '../server/ml/datasetLoader.js';
import { CLASS_CODES } from '../server/config/constants.js';

test('createPatientLesionSplits enforces zero patient and lesion leakage across 70/15/15 splits', () => {
  const records = [];
  for (let p = 1; p <= 80; p++) {
    const numLesions = p % 3 === 0 ? 2 : 1;
    for (let l = 1; l <= numLesions; l++) {
      const label = CLASS_CODES[(p + l) % CLASS_CODES.length];
      records.push({
        imgId: `PAT_${p}_LES_${l}.png`,
        patientId: `PAT_${p}`,
        lesionId: `LES_${p}_${l}`,
        label,
        labelIndex: CLASS_CODES.indexOf(label),
      });
    }
  }

  const result = createPatientLesionSplits(records);
  assert.equal(result.leakageVerified, true);
  assert.equal(result.patientLeakageCount, 0);

  const trainPatients = new Set(result.splits.train.map((r) => r.patientId));
  const valPatients = new Set(result.splits.val.map((r) => r.patientId));
  const testPatients = new Set(result.splits.test.map((r) => r.patientId));

  for (const p of valPatients) {
    assert.equal(trainPatients.has(p), false, `Patient ${p} leaked between train and val`);
  }
  for (const p of testPatients) {
    assert.equal(trainPatients.has(p), false, `Patient ${p} leaked between train and test`);
    assert.equal(valPatients.has(p), false, `Patient ${p} leaked between val and test`);
  }

  const totalCount =
    result.splits.train.length + result.splits.val.length + result.splits.test.length;
  assert.equal(totalCount, records.length);
  assert.ok(result.splits.train.length > result.splits.val.length);
  assert.ok(result.splits.train.length > result.splits.test.length);
});
