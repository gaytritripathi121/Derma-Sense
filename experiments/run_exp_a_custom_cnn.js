import fs from 'fs';
import path from 'path';
import { PATHS } from '../server/config/constants.js';
import { getTF } from '../server/ml/tfBackend.js';
import { loadModelFromDir, saveModelToDir } from '../server/ml/model.js';
import { generateGradCAM } from '../server/ml/gradcam.js';
import { computeEvaluationMetrics } from './lib/metrics.js';
import {
  augmentUint8ToFloat,
  createSeededRng,
  createWeightedSmoothedLoss,
  loadRgbUint8,
  shuffleArray,
  uint8ToFloat,
} from './lib/augmentation.js';

const EXP_DIR = 'experiments/exp_a_custom_cnn';
const IMAGE_SIZE = 160;

function buildImprovedCustomCNN(tf) {
  const reg = () => tf.regularizers.l2({ l2: 1.5e-4 });
  const input = tf.input({ shape: [IMAGE_SIZE, IMAGE_SIZE, 3], name: 'lesion_image_input' });

  let x = tf.layers
    .conv2d({
      filters: 32,
      kernelSize: 3,
      strides: 2,
      padding: 'same',
      useBias: false,
      kernelInitializer: 'heNormal',
      kernelRegularizer: reg(),
      name: 'stem_conv',
    })
    .apply(input);
  x = tf.layers.batchNormalization({ name: 'stem_bn' }).apply(x);
  x = tf.layers.reLU({ name: 'stem_relu' }).apply(x);

  x = tf.layers
    .conv2d({
      filters: 64,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      kernelInitializer: 'heNormal',
      kernelRegularizer: reg(),
      name: 'stage1_conv',
    })
    .apply(x);
  x = tf.layers.batchNormalization({ name: 'stage1_bn' }).apply(x);
  x = tf.layers.reLU({ name: 'stage1_relu' }).apply(x);
  x = tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: 'pool_1' }).apply(x);

  const skip2 = tf.layers
    .conv2d({
      filters: 128,
      kernelSize: 1,
      padding: 'same',
      useBias: false,
      kernelInitializer: 'heNormal',
      kernelRegularizer: reg(),
      name: 'stage2_skip',
    })
    .apply(x);
  let b2 = tf.layers
    .separableConv2d({
      filters: 128,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      depthwiseInitializer: 'heNormal',
      pointwiseInitializer: 'heNormal',
      pointwiseRegularizer: reg(),
      name: 'stage2_sep1',
    })
    .apply(x);
  b2 = tf.layers.batchNormalization({ name: 'stage2_bn1' }).apply(b2);
  b2 = tf.layers.reLU({ name: 'stage2_relu1' }).apply(b2);
  b2 = tf.layers
    .separableConv2d({
      filters: 128,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      depthwiseInitializer: 'heNormal',
      pointwiseInitializer: 'heNormal',
      pointwiseRegularizer: reg(),
      name: 'stage2_sep2',
    })
    .apply(b2);
  b2 = tf.layers.batchNormalization({ name: 'stage2_bn2' }).apply(b2);
  x = tf.layers.add({ name: 'stage2_add' }).apply([skip2, b2]);
  x = tf.layers.reLU({ name: 'stage2_out_relu' }).apply(x);
  x = tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: 'pool_2' }).apply(x);
  x = tf.layers.dropout({ rate: 0.1, noiseShape: [null, 1, 1, 128], name: 'sdrop_2' }).apply(x);

  const skip3 = tf.layers
    .conv2d({
      filters: 192,
      kernelSize: 1,
      padding: 'same',
      useBias: false,
      kernelInitializer: 'heNormal',
      kernelRegularizer: reg(),
      name: 'stage3_skip',
    })
    .apply(x);
  let b3 = tf.layers
    .separableConv2d({
      filters: 192,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      depthwiseInitializer: 'heNormal',
      pointwiseInitializer: 'heNormal',
      pointwiseRegularizer: reg(),
      name: 'stage3_sep1',
    })
    .apply(x);
  b3 = tf.layers.batchNormalization({ name: 'stage3_bn1' }).apply(b3);
  b3 = tf.layers.reLU({ name: 'stage3_relu1' }).apply(b3);
  b3 = tf.layers
    .separableConv2d({
      filters: 192,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      depthwiseInitializer: 'heNormal',
      pointwiseInitializer: 'heNormal',
      pointwiseRegularizer: reg(),
      name: 'stage3_sep2',
    })
    .apply(b3);
  b3 = tf.layers.batchNormalization({ name: 'stage3_bn2' }).apply(b3);
  x = tf.layers.add({ name: 'stage3_add' }).apply([skip3, b3]);
  x = tf.layers.reLU({ name: 'stage3_out_relu' }).apply(x);
  x = tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: 'pool_3' }).apply(x);
  x = tf.layers.dropout({ rate: 0.15, noiseShape: [null, 1, 1, 192], name: 'sdrop_3' }).apply(x);

  x = tf.layers
    .conv2d({
      filters: 256,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      kernelInitializer: 'heNormal',
      kernelRegularizer: reg(),
      name: 'gradcam_target_conv',
    })
    .apply(x);
  x = tf.layers.batchNormalization({ name: 'gradcam_target_bn' }).apply(x);
  x = tf.layers.reLU({ name: 'gradcam_target_relu' }).apply(x);

  x = tf.layers.globalAveragePooling2d({ name: 'global_avg_pool' }).apply(x);
  x = tf.layers.dropout({ rate: 0.4, name: 'dropout_1' }).apply(x);
  x = tf.layers
    .dense({
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      kernelRegularizer: reg(),
      name: 'dense_head',
    })
    .apply(x);
  x = tf.layers.dropout({ rate: 0.3, name: 'dropout_2' }).apply(x);
  const logits = tf.layers
    .dense({
      units: 6,
      kernelInitializer: 'glorotUniform',
      name: 'logits',
    })
    .apply(x);
  const predictions = tf.layers.activation({ activation: 'softmax', name: 'predictions' }).apply(logits);

  return tf.model({
    inputs: input,
    outputs: predictions,
    name: 'DermaNet_DeepRes_v2',
  });
}

function buildOversampledEpochList(trainRecords, rng) {
  const mult = { ACK: 1, BCC: 1, MEL: 4, NEV: 2, SCC: 2, SEK: 2 };
  const expanded = [];
  for (const r of trainRecords) {
    const m = mult[r.label] || 1;
    for (let i = 0; i < m; i++) expanded.push(r);
  }
  return shuffleArray(expanded, rng);
}

async function makeBatchTensorsStreamed(tf, slice, { augment, rng }) {
  const px = IMAGE_SIZE * IMAGE_SIZE * 3;
  const xData = new Float32Array(slice.length * px);
  const yIdx = new Int32Array(slice.length);
  for (let i = 0; i < slice.length; i++) {
    const u8 = await loadRgbUint8(slice[i].filePath, IMAGE_SIZE);
    const arr = augment
      ? augmentUint8ToFloat(u8, IMAGE_SIZE, { mode: 'zero_to_one', rng })
      : uint8ToFloat(u8, 'zero_to_one');
    xData.set(arr, i * px);
    yIdx[i] = slice[i].labelIndex;
  }
  return tf.tidy(() => {
    const xs = tf.tensor4d(xData, [slice.length, IMAGE_SIZE, IMAGE_SIZE, 3]);
    const labelT = tf.tensor1d(yIdx, 'int32');
    const ys = tf.oneHot(labelT, 6).toFloat();
    return { xs, ys };
  });
}

async function evaluateValidation(tf, model, valRecords, batchSize = 12) {
  let lossSum = 0;
  let accSum = 0;
  let total = 0;
  const valProbs = [];

  for (let i = 0; i < valRecords.length; i += batchSize) {
    const slice = valRecords.slice(i, i + batchSize);
    const { xs, ys } = await makeBatchTensorsStreamed(tf, slice, { augment: false });
    const evalOut = model.evaluate(xs, ys, { batchSize: slice.length });
    const l = (await evalOut[0].data())[0];
    const a = (await evalOut[1].data())[0];
    const preds = model.predict(xs, { batchSize: slice.length });
    const pFlat = await preds.data();
    tf.dispose([xs, ys, preds, ...evalOut]);

    lossSum += l * slice.length;
    accSum += a * slice.length;
    total += slice.length;
    for (let k = 0; k < slice.length; k++) {
      valProbs.push(Array.from(pFlat.slice(k * 6, (k + 1) * 6)));
    }
  }

  return {
    valLoss: Number((lossSum / total).toFixed(4)),
    valAccuracy: Number((accSum / total).toFixed(4)),
    valEval: computeEvaluationMetrics(valRecords, valProbs, 'validation'),
  };
}

async function main() {
  const startedAt = Date.now();
  fs.mkdirSync(EXP_DIR, { recursive: true });
  fs.mkdirSync(path.join(EXP_DIR, 'best_model'), { recursive: true });

  const splitsJson = JSON.parse(fs.readFileSync(PATHS.splitsFile, 'utf8'));
  const { train, val } = splitsJson.splits;
  const { tf, backendMode } = await getTF();
  const rng = createSeededRng(4041);

  const sampleEpoch = buildOversampledEpochList(train, rng);
  const counts = Array(6).fill(0);
  for (const r of sampleEpoch) counts[r.labelIndex]++;
  const effTotal = sampleEpoch.length;
  const classWeights = counts.map((c) =>
    Number(Math.min(3.5, Math.max(0.5, Math.pow(effTotal / (6 * c), 0.55))).toFixed(4))
  );
  console.log('[Exp A] Streamed 160x160 mode. Effective epoch size:', effTotal, 'Class weights:', classWeights);

  const model = buildImprovedCustomCNN(tf);
  const totalParams = model.countParams();
  const initialLr = 0.0008;
  const minLr = 0.00008;
  const optimizer = tf.train.adam(initialLr);
  const lossFn = createWeightedSmoothedLoss(tf, classWeights, 0.05);
  model.compile({ optimizer, loss: lossFn, metrics: ['accuracy'] });
  console.log(`[Exp A] Compiled DermaNet_DeepRes_v2 (${totalParams} params)`);

  const epochs = 14;
  const batchSize = 8;
  const patience = 5;
  const history = [];
  let bestMacroF1 = -1;
  let bestValLoss = Infinity;
  let bestEpoch = 0;
  let bestValEval = null;
  let noImprove = 0;

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const cosine = 0.5 * (1 + Math.cos((Math.PI * (epoch - 1)) / epochs));
    const lr = minLr + (initialLr - minLr) * cosine;
    optimizer.learningRate = lr;

    const epochList = buildOversampledEpochList(train, rng);
    let lossSum = 0;
    let accSum = 0;
    let seen = 0;
    for (let b = 0, step = 0; b < epochList.length; b += batchSize, step++) {
      const slice = epochList.slice(b, b + batchSize);
      const { xs, ys } = await makeBatchTensorsStreamed(tf, slice, { augment: true, rng });
      const res = await model.trainOnBatch(xs, ys);
      tf.dispose([xs, ys]);
      lossSum += (Array.isArray(res) ? res[0] : res) * slice.length;
      accSum += (Array.isArray(res) ? res[1] : 0) * slice.length;
      seen += slice.length;
      if (step % 60 === 0 && typeof global.gc === 'function') global.gc();
    }

    const { valLoss, valAccuracy, valEval } = await evaluateValidation(tf, model, val, 12);
    const trainLoss = Number((lossSum / seen).toFixed(4));
    const trainAccuracy = Number((accSum / seen).toFixed(4));
    history.push({ epoch, lr: Number(lr.toFixed(6)), trainLoss, trainAccuracy, valLoss, valAccuracy, valMacroF1: valEval.macroF1 });

    const isBetter = valEval.macroF1 > bestMacroF1 || (valEval.macroF1 === bestMacroF1 && valLoss < bestValLoss);
    if (isBetter) {
      bestMacroF1 = valEval.macroF1;
      bestValLoss = valLoss;
      bestEpoch = epoch;
      bestValEval = valEval;
      noImprove = 0;
      await saveModelToDir(tf, model, path.join(EXP_DIR, 'best_model'));
    } else {
      noImprove++;
    }

    console.log(`[Exp A] Epoch ${epoch}/${epochs} lr=${lr.toFixed(5)} loss=${trainLoss} acc=${(trainAccuracy * 100).toFixed(1)}% val_loss=${valLoss} val_acc=${(valAccuracy * 100).toFixed(1)}% val_macroF1=${(valEval.macroF1 * 100).toFixed(2)}% rss=${Math.round(process.memoryUsage().rss / 1048576)}MB${isBetter ? ' [BEST]' : ''}`);
    if (typeof global.gc === 'function') global.gc();
    if (noImprove >= patience) {
      console.log(`[Exp A] Early stopping at epoch ${epoch} (best epoch ${bestEpoch}).`);
      break;
    }
  }

  model.dispose();

  const bestLoaded = await loadModelFromDir(tf, path.join(EXP_DIR, 'best_model'));
  const sampleBuf = fs.readFileSync(val[0].filePath);
  const sampleU8 = await loadRgbUint8(val[0].filePath, IMAGE_SIZE);
  const samplePx = uint8ToFloat(sampleU8, 'zero_to_one');
  const sampleT = tf.tensor4d(samplePx, [1, IMAGE_SIZE, IMAGE_SIZE, 3]);
  const camRes = await generateGradCAM(tf, bestLoaded, sampleT, sampleBuf, 0);
  sampleT.dispose();
  bestLoaded.dispose();

  const durationMs = Date.now() - startedAt;
  const result = {
    experimentId: 'exp_a_custom_cnn',
    name: 'DermaNet_DeepRes_v2 (Improved Custom Residual Depthwise-Separable CNN)',
    architecture: 'DermaNet_DeepRes_v2 (Residual DS-Conv + Channel-wise SpatialDropout [noiseShape=[null,1,1,C]] + L2 + GAP + Dense(128))',
    totalParams,
    trainableParams: totalParams,
    imageSize: IMAGE_SIZE,
    normalization: 'zero_to_one',
    batchSize,
    learningRateSchedule: `${initialLr} -> ${minLr} cosine`,
    epochsCompleted: history.length,
    bestEpoch,
    durationMs,
    backendMode,
    gradcamLayer: 'gradcam_target_relu',
    gradcamVerified: Boolean(camRes?.heatmapBase64?.startsWith('data:image/png;base64,')),
    history,
    bestTrainingMetrics: history[bestEpoch - 1],
    validationEvaluation: bestValEval,
  };

  fs.writeFileSync(path.join(EXP_DIR, 'result.json'), JSON.stringify(result, null, 2));
  console.log('EXP_A_COMPLETE:', JSON.stringify({
    bestEpoch,
    durationSec: (durationMs / 1000).toFixed(1),
    valAccuracy: bestValEval.accuracy,
    valMacroPrecision: bestValEval.macroPrecision,
    valMacroRecall: bestValEval.macroRecall,
    valMacroF1: bestValEval.macroF1,
    valWeightedF1: bestValEval.weightedF1,
    valMacroRocAuc: bestValEval.macroRocAuc,
    gradcamVerified: result.gradcamVerified,
    perClass: bestValEval.perClass.map((c) => ({ code: c.code, support: c.support, p: c.precision, r: c.recall, f1: c.f1 })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
