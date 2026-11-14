import fs from 'fs';
import { CLASS_CODES, PATHS } from '../config/constants.js';
import { loadBatchTensors } from './preprocessing.js';

function computeRocAucOneVsRest(yTrueBinary, yScores) {
  const positives = yTrueBinary.filter((v) => v === 1).length;
  const negatives = yTrueBinary.length - positives;
  if (positives === 0 || negatives === 0) return null;

  const pairs = yScores.map((score, i) => ({ score, label: yTrueBinary[i] }));
  pairs.sort((a, b) => b.score - a.score);

  let tp = 0;
  let fp = 0;
  let prevTp = 0;
  let prevFp = 0;
  let auc = 0;

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].label === 1) tp++;
    else fp++;

    const isLastOrDiff =
      i === pairs.length - 1 || pairs[i + 1].score !== pairs[i].score;
    if (isLastOrDiff) {
      const tpr = tp / positives;
      const fpr = fp / negatives;
      const prevTpr = prevTp / positives;
      const prevFpr = prevFp / negatives;
      auc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
      prevTp = tp;
      prevFp = fp;
    }
  }
  return Number(auc.toFixed(4));
}

export async function evaluateModelOnSplit(tf, model, testRecords, imageSize = 192, batchSize = 16) {
  const numClasses = CLASS_CODES.length;
  const confusionMatrix = Array.from({ length: numClasses }, () =>
    Array(numClasses).fill(0)
  );
  const allTrue = [];
  const allPred = [];
  const allProbs = [];
  const maxConfidences = [];
  const isCorrectList = [];

  for (let i = 0; i < testRecords.length; i += batchSize) {
    const slice = testRecords.slice(i, i + batchSize);
    const { xs, ys } = await loadBatchTensors(tf, slice, imageSize, { augment: false });
    const predsTensor = model.predict(xs, { batchSize: slice.length });
    const probsData = await predsTensor.data();
    tf.dispose([xs, ys, predsTensor]);

    for (let r = 0; r < slice.length; r++) {
      const trueIdx = slice[r].labelIndex;
      const probs = [];
      let bestIdx = 0;
      let bestProb = -1;
      for (let c = 0; c < numClasses; c++) {
        const p = probsData[r * numClasses + c];
        probs.push(p);
        if (p > bestProb) {
          bestProb = p;
          bestIdx = c;
        }
      }
      confusionMatrix[trueIdx][bestIdx]++;
      allTrue.push(trueIdx);
      allPred.push(bestIdx);
      allProbs.push(probs);
      maxConfidences.push(bestProb);
      isCorrectList.push(bestIdx === trueIdx ? 1 : 0);
    }
  }

  const total = allTrue.length;
  const correct = isCorrectList.reduce((a, b) => a + b, 0);
  const accuracy = total > 0 ? correct / total : 0;

  const perClass = CLASS_CODES.map((code, c) => {
    const tp = confusionMatrix[c][c];
    let fp = 0;
    let fn = 0;
    let support = 0;
    for (let i = 0; i < numClasses; i++) {
      support += confusionMatrix[c][i];
      if (i !== c) {
        fp += confusionMatrix[i][c];
        fn += confusionMatrix[c][i];
      }
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    const yBin = allTrue.map((t) => (t === c ? 1 : 0));
    const yScr = allProbs.map((p) => p[c]);
    const rocAuc = computeRocAucOneVsRest(yBin, yScr);

    return {
      code,
      support,
      tp,
      fp,
      fn,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      rocAuc,
    };
  });

  const activeClasses = perClass.filter((c) => c.support > 0);
  const denom = Math.max(1, activeClasses.length);
  const macroPrecision = activeClasses.reduce((s, c) => s + c.precision, 0) / denom;
  const macroRecall = activeClasses.reduce((s, c) => s + c.recall, 0) / denom;
  const macroF1 = activeClasses.reduce((s, c) => s + c.f1, 0) / denom;

  const weightedPrecision =
    total > 0 ? perClass.reduce((s, c) => s + c.precision * c.support, 0) / total : 0;
  const weightedRecall =
    total > 0 ? perClass.reduce((s, c) => s + c.recall * c.support, 0) / total : 0;
  const weightedF1 =
    total > 0 ? perClass.reduce((s, c) => s + c.f1 * c.support, 0) / total : 0;

  const validAucs = perClass.map((c) => c.rocAuc).filter((v) => v !== null);
  const macroRocAuc =
    validAucs.length > 0
      ? Number((validAucs.reduce((a, b) => a + b, 0) / validAucs.length).toFixed(4))
      : null;

  const calibrationBins = [];
  let ece = 0;
  for (let b = 0; b < 10; b++) {
    const low = b / 10;
    const high = (b + 1) / 10;
    const idxs = [];
    for (let i = 0; i < maxConfidences.length; i++) {
      const conf = maxConfidences[i];
      if ((conf >= low && conf < high) || (b === 9 && conf === 1)) {
        idxs.push(i);
      }
    }
    const count = idxs.length;
    const avgConf = count > 0 ? idxs.reduce((s, idx) => s + maxConfidences[idx], 0) / count : (low + high) / 2;
    const avgAcc = count > 0 ? idxs.reduce((s, idx) => s + isCorrectList[idx], 0) / count : 0;
    if (count > 0 && total > 0) {
      ece += (count / total) * Math.abs(avgAcc - avgConf);
    }
    calibrationBins.push({
      bin: `${Math.round(low * 100)}-${Math.round(high * 100)}%`,
      count,
      avgConfidence: count > 0 ? Number(avgConf.toFixed(4)) : null,
      empiricalAccuracy: count > 0 ? Number(avgAcc.toFixed(4)) : null,
    });
  }

  const evaluation = {
    evaluatedAt: new Date().toISOString(),
    splitName: 'held_out_test',
    testSampleCount: total,
    accuracy: Number(accuracy.toFixed(4)),
    macroPrecision: Number(macroPrecision.toFixed(4)),
    macroRecall: Number(macroRecall.toFixed(4)),
    macroF1: Number(macroF1.toFixed(4)),
    weightedPrecision: Number(weightedPrecision.toFixed(4)),
    weightedRecall: Number(weightedRecall.toFixed(4)),
    weightedF1: Number(weightedF1.toFixed(4)),
    macroRocAuc,
    expectedCalibrationError: Number(ece.toFixed(4)),
    confusionMatrix,
    classOrder: CLASS_CODES,
    perClass,
    calibrationBins,
  };

  fs.mkdirSync(PATHS.outputsDir + '/metrics', { recursive: true });
  fs.writeFileSync(PATHS.metricsFile, JSON.stringify(evaluation, null, 2));
  return evaluation;
}
