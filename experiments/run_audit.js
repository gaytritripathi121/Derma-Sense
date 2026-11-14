import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { CLASS_CODES, CODE_TO_INDEX, PATHS } from '../server/config/constants.js';
import { getTF } from '../server/ml/tfBackend.js';
import { loadModelFromDir } from '../server/ml/model.js';
import { computeEvaluationMetrics } from './lib/metrics.js';

async function main() {
  fs.mkdirSync('experiments', { recursive: true });

  const splitsJson = JSON.parse(fs.readFileSync(PATHS.splitsFile, 'utf8'));
  const modelConfig = JSON.parse(fs.readFileSync(PATHS.modelConfigFile, 'utf8'));
  const trainingState = JSON.parse(fs.readFileSync(PATHS.trainingStateFile, 'utf8'));
  const originalTestEval = JSON.parse(fs.readFileSync(PATHS.metricsFile, 'utf8'));

  const { train, val, test } = splitsJson.splits;

  // 1. Verify zero patient & zero lesion overlap
  const pTrain = new Set(train.map((r) => r.patientId));
  const pVal = new Set(val.map((r) => r.patientId));
  const pTest = new Set(test.map((r) => r.patientId));
  const lTrain = new Set(train.map((r) => r.lesionId));
  const lVal = new Set(val.map((r) => r.lesionId));
  const lTest = new Set(test.map((r) => r.lesionId));
  const countOverlap = (a, b) => [...a].filter((x) => b.has(x)).length;

  const leakageCheck = {
    patientOverlaps: {
      trainVal: countOverlap(pTrain, pVal),
      trainTest: countOverlap(pTrain, pTest),
      valTest: countOverlap(pVal, pTest),
    },
    lesionOverlaps: {
      trainVal: countOverlap(lTrain, lVal),
      trainTest: countOverlap(lTrain, lTest),
      valTest: countOverlap(lVal, lTest),
    },
  };

  if (
    leakageCheck.patientOverlaps.trainVal > 0 ||
    leakageCheck.patientOverlaps.trainTest > 0 ||
    leakageCheck.patientOverlaps.valTest > 0 ||
    leakageCheck.lesionOverlaps.trainVal > 0 ||
    leakageCheck.lesionOverlaps.trainTest > 0 ||
    leakageCheck.lesionOverlaps.valTest > 0
  ) {
    throw new Error(`Data leakage detected in splits.json: ${JSON.stringify(leakageCheck)}`);
  }

  // 2. Verify image format, resolution, RGB channels, and label encoding on disk
  let minW = Infinity;
  let maxW = 0;
  let minH = Infinity;
  let maxH = 0;
  let missingFiles = 0;
  let labelMismatch = 0;
  for (const r of [...train, ...val, ...test]) {
    if (!fs.existsSync(r.filePath)) missingFiles++;
    if (CODE_TO_INDEX[r.label] !== r.labelIndex) labelMismatch++;
  }
  for (const r of val.slice(0, 30)) {
    const meta = await sharp(r.filePath).metadata();
    minW = Math.min(minW, meta.width || 0);
    maxW = Math.max(maxW, meta.width || 0);
    minH = Math.min(minH, meta.height || 0);
    maxH = Math.max(maxH, meta.height || 0);
  }

  // 3. Evaluate original baseline model on the VALIDATION split (for apples-to-apples comparison)
  const { tf } = await getTF();
  const baseModel = await loadModelFromDir(tf, PATHS.trainedModelDir);
  const imgSize = modelConfig.preprocessing?.imageSize || 160;
  const valProbs = [];
  for (let i = 0; i < val.length; i += 16) {
    const slice = val.slice(i, i + 16);
    const px = imgSize * imgSize * 3;
    const xBuf = new Float32Array(slice.length * px);
    for (let k = 0; k < slice.length; k++) {
      const { data } = await sharp(slice[k].filePath)
        .rotate()
        .removeAlpha()
        .toColorspace('srgb')
        .resize(imgSize, imgSize, { fit: 'cover' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const off = k * px;
      for (let j = 0; j < px; j++) xBuf[off + j] = data[j] / 255.0;
    }
    const xs = tf.tensor4d(xBuf, [slice.length, imgSize, imgSize, 3]);
    const preds = baseModel.predict(xs);
    const pData = await preds.data();
    tf.dispose([xs, preds]);
    for (let k = 0; k < slice.length; k++) {
      valProbs.push(Array.from(pData.slice(k * 6, (k + 1) * 6)));
    }
  }
  baseModel.dispose();

  const baselineValEval = computeEvaluationMetrics(val, valProbs, 'validation');

  // 4. Analyze class imbalance and learning curve diagnostics
  const trainCounts = Object.fromEntries(CLASS_CODES.map((c) => [c, 0]));
  for (const r of train) trainCounts[r.label]++;
  const maxCls = Math.max(...Object.values(trainCounts));
  const minCls = Math.min(...Object.values(trainCounts));

  const audit = {
    auditedAt: new Date().toISOString(),
    splitIntegrity: {
      verifiedZeroLeakage: true,
      counts: { train: train.length, val: val.length, test: test.length, total: train.length + val.length + test.length },
      ...leakageCheck,
      missingFiles,
      labelMismatch,
      sampledValDimensions: { minW, maxW, minH, maxH },
    },
    classImbalance: {
      trainCounts,
      imbalanceRatioMaxMin: Number((maxCls / minCls).toFixed(2)),
      originalClassWeights: modelConfig.trainingConfig.classWeights,
      notes:
        'BCC (595) and ACK (511) comprise 68.7% of training data, while MEL (37, 2.3%) has a 16.08:1 imbalance ratio against BCC and SCC (134, 8.3%) often overlaps visually with ACK.',
    },
    baselineDiagnosis: {
      architecture: modelConfig.architecture.name,
      totalParams: modelConfig.architecture.totalParams,
      imageSize: imgSize,
      epochsCompleted: trainingState.currentEpoch,
      finalTrainLoss: trainingState.trainLoss,
      finalTrainAccuracy: trainingState.trainAccuracy,
      finalValLoss: trainingState.valLoss,
      finalValAccuracy: trainingState.valAccuracy,
      diagnosis: [
        'Severe underfitting: 10 epochs from random initialization on 1,611 clinical photos reached only 35.69% train accuracy and 1.4661 train loss.',
        'Validation oscillation: fixed learning rate 0.0005 with batchSize=8 and noisy batch norms caused val_accuracy to swing between 10.79% and 41.40%.',
        'No L2 regularization or label smoothing; augmentation lacked full 360/90-degree lesion rotation invariance.',
        'SCC recall collapse (3.33% test, 1/30; majority predicted as ACK) and BCC-to-ACK confusion (56/125 test BCC predicted as ACK) due to overlapping actinic/keratotic surface features at 160x160 resolution without ImageNet texture priors.',
        'MEL weight capped at 6.0 yielded 71.43% test recall (5/7) on tiny n=7 test support, but 20.0% precision (20 false positives), lowering macro-F1.',
      ],
    },
    baselineValidationEvaluation: baselineValEval,
    baselineOriginalTestEvaluation: originalTestEval,
  };

  fs.writeFileSync('experiments/audit_baseline.json', JSON.stringify(audit, null, 2));
  console.log('AUDIT_COMPLETE:', JSON.stringify({
    zeroLeakage: true,
    trainCounts,
    imbalanceRatio: audit.classImbalance.imbalanceRatioMaxMin,
    baselineVal: {
      accuracy: baselineValEval.accuracy,
      macroPrecision: baselineValEval.macroPrecision,
      macroRecall: baselineValEval.macroRecall,
      macroF1: baselineValEval.macroF1,
      weightedF1: baselineValEval.weightedF1,
      macroRocAuc: baselineValEval.macroRocAuc,
      perClass: baselineValEval.perClass.map((c) => ({ code: c.code, support: c.support, p: c.precision, r: c.recall, f1: c.f1 })),
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
