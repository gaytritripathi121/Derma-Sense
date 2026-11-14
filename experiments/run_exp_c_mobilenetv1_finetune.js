import fs from 'fs';
import path from 'path';
import { PATHS } from '../server/config/constants.js';
import { getTF } from '../server/ml/tfBackend.js';
import { loadModelFromDir, saveModelToDir } from '../server/ml/model.js';
import { computeEvaluationMetrics } from './lib/metrics.js';
import {
  augmentUint8ToFloat,
  createSeededRng,
  createWeightedSmoothedLoss,
  loadRgbUint8,
  shuffleArray,
  uint8ToFloat,
} from './lib/augmentation.js';

const MOBILENET_V1_URL = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json';
const CACHE_DIR = 'experiments/pretrained_cache/mobilenet_v1';
const EXP_DIR = 'experiments/exp_c_mobilenetv1_finetune';
const IMAGE_SIZE = 224;
const TARGET_CONV_LAYER = 'conv_pw_13_relu';

async function buildMobileNetV1TransferModel(tf) {
  const localJson = path.join(CACHE_DIR, 'model.json');
  let base;
  if (fs.existsSync(localJson)) {
    base = await tf.loadLayersModel(`file://${path.resolve(localJson)}`);
  } else {
    console.log('[Exp C] Downloading & caching official ImageNet MobileNetV1 LayersModel...');
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    base = await tf.loadLayersModel(MOBILENET_V1_URL);
    await base.save(`file://${path.resolve(CACHE_DIR)}`);
  }

  const convOut = base.getLayer(TARGET_CONV_LAYER).output;
  let x = tf.layers.globalAveragePooling2d({ name: 'global_avg_pool' }).apply(convOut);
  x = tf.layers.batchNormalization({ name: 'head_bn' }).apply(x);
  x = tf.layers.dropout({ rate: 0.45, name: 'head_dropout_1' }).apply(x);
  x = tf.layers
    .dense({
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      kernelRegularizer: tf.regularizers.l2({ l2: 2e-4 }),
      name: 'head_dense',
    })
    .apply(x);
  x = tf.layers.dropout({ rate: 0.3, name: 'head_dropout_2' }).apply(x);
  const logits = tf.layers
    .dense({
      units: 6,
      kernelInitializer: 'glorotUniform',
      name: 'logits',
    })
    .apply(x);
  const predictions = tf.layers.activation({ activation: 'softmax', name: 'predictions' }).apply(logits);

  return tf.model({
    inputs: base.inputs,
    outputs: predictions,
    name: 'MobileNetV1_ImageNet_FineTuned',
  });
}

function setBackboneTrainable(model, mode) {
  const upperPrefixes = ['conv_dw_12', 'conv_pw_12', 'conv_dw_13', 'conv_pw_13'];
  const headLayers = new Set(['global_avg_pool', 'head_bn', 'head_dropout_1', 'head_dense', 'head_dropout_2', 'logits', 'predictions']);

  for (const layer of model.layers) {
    if (headLayers.has(layer.name)) {
      layer.trainable = true;
      continue;
    }
    if (mode === 'upper_blocks') {
      const isUpperConv = upperPrefixes.some((p) => layer.name.startsWith(p));
      const isBn = layer.getClassName() === 'BatchNormalization';
      layer.trainable = isUpperConv && !isBn;
    } else {
      layer.trainable = false;
    }
  }
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
      ? augmentUint8ToFloat(u8, IMAGE_SIZE, { mode: 'minus_one_to_one', rng })
      : uint8ToFloat(u8, 'minus_one_to_one');
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

async function evaluateValidation(tf, model, valRecords, batchSize = 8) {
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
  const rng = createSeededRng(3031);

  const sampleEpoch = buildOversampledEpochList(train, rng);
  const oversampledCounts = Array(6).fill(0);
  for (const r of sampleEpoch) oversampledCounts[r.labelIndex]++;
  const effTotal = sampleEpoch.length;
  const classWeights = oversampledCounts.map((c) =>
    Number(Math.min(3.5, Math.max(0.5, Math.pow(effTotal / (6 * c), 0.55))).toFixed(4))
  );
  console.log('[Exp C] Streamed 224x224 mode. Effective epoch size:', effTotal, 'Class weights:', classWeights);

  let model = await buildMobileNetV1TransferModel(tf);
  const totalParams = model.countParams();
  const lossFn = createWeightedSmoothedLoss(tf, classWeights, 0.05);

  const history = [];
  let bestMacroF1 = -1;
  let bestValLoss = Infinity;
  let bestEpoch = 0;
  let bestValEval = null;

  // Phase 1: Frozen backbone head warmup (batchSize=8, zero RAM preload)
  setBackboneTrainable(model, 'head_only');
  const phase1Trainable = model.trainableWeights.reduce((s, w) => s + w.shape.reduce((a, b) => a * b, 1), 0);
  const opt1 = tf.train.adam(0.0007);
  model.compile({ optimizer: opt1, loss: lossFn, metrics: ['accuracy'] });
  console.log(`[Exp C] Phase 1 (Head Warmup): totalParams=${totalParams}, trainableParams=${phase1Trainable}`);

  const phase1Epochs = 5;
  const phase1Batch = 8;
  for (let epoch = 1; epoch <= phase1Epochs; epoch++) {
    const epochList = buildOversampledEpochList(train, rng);
    let lossSum = 0;
    let accSum = 0;
    let seen = 0;
    for (let b = 0, step = 0; b < epochList.length; b += phase1Batch, step++) {
      const slice = epochList.slice(b, b + phase1Batch);
      const { xs, ys } = await makeBatchTensorsStreamed(tf, slice, { augment: true, rng });
      const res = await model.trainOnBatch(xs, ys);
      tf.dispose([xs, ys]);
      lossSum += (Array.isArray(res) ? res[0] : res) * slice.length;
      accSum += (Array.isArray(res) ? res[1] : 0) * slice.length;
      seen += slice.length;
      if (step % 60 === 0 && typeof global.gc === 'function') global.gc();
    }
    const { valLoss, valAccuracy, valEval } = await evaluateValidation(tf, model, val, 8);
    const trainLoss = Number((lossSum / seen).toFixed(4));
    const trainAccuracy = Number((accSum / seen).toFixed(4));
    history.push({ phase: 1, epoch, lr: 0.0007, trainLoss, trainAccuracy, valLoss, valAccuracy, valMacroF1: valEval.macroF1 });

    const isBetter = valEval.macroF1 > bestMacroF1 || (valEval.macroF1 === bestMacroF1 && valLoss < bestValLoss);
    if (isBetter) {
      bestMacroF1 = valEval.macroF1;
      bestValLoss = valLoss;
      bestEpoch = history.length;
      bestValEval = valEval;
      await saveModelToDir(tf, model, path.join(EXP_DIR, 'best_model'));
    }
    console.log(`[Exp C][P1] Epoch ${epoch}/${phase1Epochs} loss=${trainLoss} acc=${(trainAccuracy * 100).toFixed(1)}% val_loss=${valLoss} val_acc=${(valAccuracy * 100).toFixed(1)}% val_macroF1=${(valEval.macroF1 * 100).toFixed(2)}% rss=${Math.round(process.memoryUsage().rss / 1048576)}MB${isBetter ? ' [BEST]' : ''}`);
    if (typeof global.gc === 'function') global.gc();
  }

  // Phase 2: Fine-tune upper depthwise blocks from Phase 1 best weights (batchSize=6 for low activation footprint)
  model.dispose();
  if (typeof global.gc === 'function') global.gc();
  model = await loadModelFromDir(tf, path.join(EXP_DIR, 'best_model'));
  setBackboneTrainable(model, 'upper_blocks');
  const phase2Trainable = model.trainableWeights.reduce((s, w) => s + w.shape.reduce((a, b) => a * b, 1), 0);
  const opt2 = tf.train.adam(0.00004);
  model.compile({ optimizer: opt2, loss: lossFn, metrics: ['accuracy'] });
  console.log(`[Exp C] Phase 2 (Upper-Block Fine-Tuning): trainableParams=${phase2Trainable}`);

  const phase2Epochs = 6;
  const phase2Batch = 6;
  let noImprove = 0;
  for (let epoch = 1; epoch <= phase2Epochs; epoch++) {
    const lr = 0.00004 * (0.5 * (1 + Math.cos((Math.PI * (epoch - 1)) / phase2Epochs))) + 0.00001;
    opt2.learningRate = lr;

    const epochList = buildOversampledEpochList(train, rng);
    let lossSum = 0;
    let accSum = 0;
    let seen = 0;
    for (let b = 0, step = 0; b < epochList.length; b += phase2Batch, step++) {
      const slice = epochList.slice(b, b + phase2Batch);
      const { xs, ys } = await makeBatchTensorsStreamed(tf, slice, { augment: true, rng });
      const res = await model.trainOnBatch(xs, ys);
      tf.dispose([xs, ys]);
      lossSum += (Array.isArray(res) ? res[0] : res) * slice.length;
      accSum += (Array.isArray(res) ? res[1] : 0) * slice.length;
      seen += slice.length;
      if (step % 60 === 0 && typeof global.gc === 'function') global.gc();
    }
    const { valLoss, valAccuracy, valEval } = await evaluateValidation(tf, model, val, 8);
    const trainLoss = Number((lossSum / seen).toFixed(4));
    const trainAccuracy = Number((accSum / seen).toFixed(4));
    history.push({ phase: 2, epoch: phase1Epochs + epoch, lr: Number(lr.toFixed(6)), trainLoss, trainAccuracy, valLoss, valAccuracy, valMacroF1: valEval.macroF1 });

    const isBetter = valEval.macroF1 > bestMacroF1 || (valEval.macroF1 === bestMacroF1 && valLoss < bestValLoss);
    if (isBetter) {
      bestMacroF1 = valEval.macroF1;
      bestValLoss = valLoss;
      bestEpoch = history.length;
      bestValEval = valEval;
      noImprove = 0;
      await saveModelToDir(tf, model, path.join(EXP_DIR, 'best_model'));
    } else {
      noImprove++;
    }
    console.log(`[Exp C][P2] Epoch ${epoch}/${phase2Epochs} lr=${lr.toFixed(6)} loss=${trainLoss} acc=${(trainAccuracy * 100).toFixed(1)}% val_loss=${valLoss} val_acc=${(valAccuracy * 100).toFixed(1)}% val_macroF1=${(valEval.macroF1 * 100).toFixed(2)}% rss=${Math.round(process.memoryUsage().rss / 1048576)}MB${isBetter ? ' [BEST]' : ''}`);
    if (typeof global.gc === 'function') global.gc();
    if (noImprove >= 3) {
      console.log(`[Exp C] Early stopping Phase 2 at epoch ${epoch} (best overall epoch ${bestEpoch}).`);
      break;
    }
  }

  model.dispose();

  const bestLoaded = await loadModelFromDir(tf, path.join(EXP_DIR, 'best_model'));
  const sampleU8 = await loadRgbUint8(val[0].filePath, IMAGE_SIZE);
  const samplePx = uint8ToFloat(sampleU8, 'minus_one_to_one');
  const sampleT = tf.tensor4d(samplePx, [1, IMAGE_SIZE, IMAGE_SIZE, 3]);
  let gradcamOk = false;
  try {
    const targetLayer = bestLoaded.getLayer(TARGET_CONV_LAYER);
    const logitsLayer = bestLoaded.getLayer('logits');
    const featureModel = tf.model({ inputs: bestLoaded.inputs, outputs: targetLayer.output });
    const headIn = tf.input({ shape: targetLayer.outputShape.slice(1) });
    let h = headIn;
    for (let i = bestLoaded.layers.indexOf(targetLayer) + 1; i <= bestLoaded.layers.indexOf(logitsLayer); i++) {
      h = bestLoaded.layers[i].apply(h);
    }
    const headModel = tf.model({ inputs: headIn, outputs: h });
    const cam = tf.tidy(() => {
      const f = featureModel.predict(sampleT);
      const gf = tf.grad((ct) => headModel.apply(ct, { training: false }).gather([0], 1).squeeze());
      const grads = gf(f);
      return tf.relu(f.mul(grads.mean([1, 2]).reshape([1, 1, 1, -1])).sum(-1).squeeze());
    });
    gradcamOk = cam.shape.length === 2;
    cam.dispose();
  } finally {
    sampleT.dispose();
    bestLoaded.dispose();
  }

  const durationMs = Date.now() - startedAt;
  const result = {
    experimentId: 'exp_c_mobilenetv1_finetune',
    name: 'MobileNetV1 ImageNet Two-Phase Fine-Tuning (Practical Alternative to Unavailable EfficientNetB0 TFJS)',
    architecture: 'MobileNetV1_1.0_224 (conv_pw_13_relu) + GAP + BN + Dense(128) + Dropout + Softmax(6)',
    totalParams,
    phase1TrainableParams: phase1Trainable,
    phase2TrainableParams: phase2Trainable,
    imageSize: IMAGE_SIZE,
    normalization: 'minus_one_to_one',
    batchSize: `${phase1Batch} (P1) / ${phase2Batch} (P2)`,
    learningRateSchedule: '0.0007 (P1) -> 0.00005..0.00001 cosine (P2)',
    epochsCompleted: history.length,
    bestEpoch,
    durationMs,
    backendMode,
    efficientNetStatus:
      'EfficientNetB0 TFHub endpoints returned HTML redirects instead of valid model.json (incompatible without offline Python conversion). MobileNetV1 LayersModel executed as a verified full-backprop transfer-learning alternative.',
    gradcamLayer: TARGET_CONV_LAYER,
    gradcamVerified: gradcamOk,
    history,
    bestTrainingMetrics: history[bestEpoch - 1],
    validationEvaluation: bestValEval,
  };

  fs.writeFileSync(path.join(EXP_DIR, 'result.json'), JSON.stringify(result, null, 2));
  console.log('EXP_C_COMPLETE:', JSON.stringify({
    bestEpoch,
    durationSec: (durationMs / 1000).toFixed(1),
    valAccuracy: bestValEval.accuracy,
    valMacroPrecision: bestValEval.macroPrecision,
    valMacroRecall: bestValEval.macroRecall,
    valMacroF1: bestValEval.macroF1,
    valWeightedF1: bestValEval.weightedF1,
    valMacroRocAuc: bestValEval.macroRocAuc,
    gradcamOk,
    perClass: bestValEval.perClass.map((c) => ({ code: c.code, support: c.support, p: c.precision, r: c.recall, f1: c.f1 })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
