import fs from 'fs';
import path from 'path';
import { CLASS_CODES, MENDELEY_DATASET_INFO, PATHS } from '../server/config/constants.js';
import { getTF } from '../server/ml/tfBackend.js';
import { loadModelFromDir } from '../server/ml/model.js';
import { computeEvaluationMetrics } from './lib/metrics.js';
import { loadRgbUint8, uint8ToFloat } from './lib/augmentation.js';

const EXP_B_DIR = 'experiments/exp_b_mobilenetv2';
const CACHE_V2_DIR = 'experiments/pretrained_cache/mobilenet_v2';
const SELECTED_DIR = 'models/selectedModel';
const BACKBONE_DEST = path.join(SELECTED_DIR, 'backbone');
const HEAD_DEST = path.join(SELECTED_DIR, 'head');
const TEST_EVAL_BACKUP = 'experiments/selected_model_test_evaluation.json';
const SELECTED_EVAL_FILE = path.join(SELECTED_DIR, 'evaluation.json');
const SELECTED_CONFIG_FILE = path.join(SELECTED_DIR, 'modelConfig.json');

const CONV_NODE = 'module_apply_default/MobilenetV2/Conv_1/Relu6';
const IMAGE_SIZE = 224;

function copyDirClean(srcDir, dstDir, allowedFiles) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const name of allowedFiles) {
    const src = path.join(srcDir, name);
    if (!fs.existsSync(src)) {
      throw new Error(`Required model artifact missing: ${src}`);
    }
    fs.copyFileSync(src, path.join(dstDir, name));
  }
}

async function main() {
  if (fs.existsSync(TEST_EVAL_BACKUP) || fs.existsSync(SELECTED_EVAL_FILE)) {
    throw new Error(
      'Held-out test evaluation already exists for the selected model. Refusing to evaluate splits.test more than once.'
    );
  }

  const splitsJson = JSON.parse(fs.readFileSync(PATHS.splitsFile, 'utf8'));
  const { train, val, test } = splitsJson.splits;

  const trainValPatients = new Set([...train, ...val].map((r) => r.patientId));
  const testPatientOverlap = test.filter((r) => trainValPatients.has(r.patientId)).length;
  if (testPatientOverlap !== 0) {
    throw new Error(`Patient leakage detected in test split: ${testPatientOverlap} overlaps.`);
  }

  const expBResult = JSON.parse(fs.readFileSync(path.join(EXP_B_DIR, 'result.json'), 'utf8'));

  // Stage local offline artifacts under models/selectedModel/ without altering originals
  copyDirClean(CACHE_V2_DIR, BACKBONE_DEST, [
    'model.json',
    'group1-shard1of4',
    'group1-shard2of4',
    'group1-shard3of4',
    'group1-shard4of4',
  ]);
  copyDirClean(path.join(EXP_B_DIR, 'best_model'), HEAD_DEST, ['model.json', 'weights.bin']);

  const { tf, backendMode } = await getTF();
  const backbone = await tf.loadGraphModel(`file://${path.resolve(BACKBONE_DEST, 'model.json')}`);
  const head = await loadModelFromDir(tf, path.resolve(HEAD_DEST));

  console.log(`[Selected Test Eval] Evaluating MobileNetV2 (Exp B Epoch ${expBResult.bestEpoch}) once on n=${test.length} held-out test images...`);

  const BATCH = 16;
  const px = IMAGE_SIZE * IMAGE_SIZE * 3;
  const allProbs = [];

  for (let i = 0; i < test.length; i += BATCH) {
    const slice = test.slice(i, i + BATCH);
    const batchData = new Float32Array(slice.length * px);
    for (let k = 0; k < slice.length; k++) {
      const u8 = await loadRgbUint8(slice[k].filePath, IMAGE_SIZE);
      const fl = uint8ToFloat(u8, 'zero_to_one');
      batchData.set(fl, k * px);
    }

    const probsTensor = tf.tidy(() => {
      const xs = tf.tensor4d(batchData, [slice.length, IMAGE_SIZE, IMAGE_SIZE, 3]);
      const convMap = backbone.execute(xs, CONV_NODE);
      const pooled = convMap.mean([1, 2]);
      return head.predict(pooled);
    });

    const pFlat = await probsTensor.data();
    probsTensor.dispose();

    for (let k = 0; k < slice.length; k++) {
      allProbs.push(Array.from(pFlat.slice(k * 6, (k + 1) * 6)));
    }
  }

  // Verify Grad-CAM on 1 sample inside selectedModel
  const sampleU8 = await loadRgbUint8(test[0].filePath, IMAGE_SIZE);
  const sampleFl = uint8ToFloat(sampleU8, 'zero_to_one');
  const logitsLayer = head.getLayer('logits');
  const headInput = tf.input({ shape: [1280] });
  let h = headInput;
  for (let i = 1; i <= head.layers.indexOf(logitsLayer); i++) {
    h = head.layers[i].apply(h);
  }
  const headLogitModel = tf.model({ inputs: headInput, outputs: h });

  const gradcamCheck = tf.tidy(() => {
    const x = tf.tensor4d(sampleFl, [1, IMAGE_SIZE, IMAGE_SIZE, 3]);
    const convMap = backbone.execute(x, CONV_NODE);
    const gradFn = tf.grad((convTensor) => {
      const pooled = convTensor.mean([1, 2]);
      const logits = headLogitModel.apply(pooled, { training: false });
      return logits.gather([0], 1).squeeze();
    });
    const grads = gradFn(convMap);
    const weights = grads.mean([1, 2]);
    const cam = tf.relu(convMap.mul(weights.reshape([1, 1, 1, -1])).sum(-1).squeeze());
    return {
      convNode: CONV_NODE,
      featureMapShape: cam.shape,
      maxVal: Number(cam.max().dataSync()[0].toFixed(6)),
    };
  });

  tf.dispose([head, headLogitModel]);
  backbone.dispose();

  const testEvaluation = computeEvaluationMetrics(test, allProbs, 'held_out_test');
  const melMetrics = testEvaluation.perClass.find((c) => c.code === 'MEL');
  const sccMetrics = testEvaluation.perClass.find((c) => c.code === 'SCC');

  const modelConfig = {
    modelVersion: '2.0.0-mobilenetv2',
    modelType: 'mobilenet_v2_hybrid',
    selectedExperimentId: expBResult.experimentId,
    architecture: {
      name: 'MobileNetV2_1.0_224 (Frozen ImageNet GraphModel + Regularized GAP Head)',
      totalParams: expBResult.totalParams,
      backboneParamsApprox: expBResult.backboneParamsApprox,
      trainableParams: expBResult.trainableParams,
      convNode: CONV_NODE,
      gradcamLayer: CONV_NODE,
      backboneDir: 'backbone',
      headDir: 'head',
    },
    trainedAt: expBResult.validationEvaluation.evaluatedAt,
    evaluatedTestAt: testEvaluation.evaluatedAt,
    datasetSource: MENDELEY_DATASET_INFO.sourcePage,
    classMapping: Object.fromEntries(CLASS_CODES.map((c, i) => [i, c])),
    preprocessing: {
      imageSize: IMAGE_SIZE,
      channels: 3,
      normalization: 'zero_to_one',
      colorSpace: 'RGB',
      note: 'External [0, 1] RGB; MobileNetV2 GraphModel internally maps 2x - 1 to [-1, 1].',
    },
    trainingConfig: {
      epochsCompleted: expBResult.epochsCompleted,
      bestEpoch: expBResult.bestEpoch,
      batchSize: expBResult.batchSize,
      learningRateSchedule: expBResult.learningRateSchedule,
      optimizer: 'Adam',
      loss: 'Class-Weighted Categorical Cross-Entropy with 0.05 Label Smoothing',
      confidenceThreshold: 0.7,
      backendMode,
    },
    splitSummary: splitsJson.summary,
    gradcamCheck,
  };

  const fullReport = {
    selectedExperiment: 'exp_b_mobilenetv2',
    bestEpoch: expBResult.bestEpoch,
    patientLeakageVerifiedZero: testPatientOverlap === 0,
    validationEvaluation: expBResult.validationEvaluation,
    testEvaluation,
    highRiskSpotlight: {
      MEL: melMetrics,
      SCC: sccMetrics,
    },
  };

  fs.writeFileSync(SELECTED_EVAL_FILE, JSON.stringify(testEvaluation, null, 2));
  fs.writeFileSync(SELECTED_CONFIG_FILE, JSON.stringify(modelConfig, null, 2));
  fs.writeFileSync(TEST_EVAL_BACKUP, JSON.stringify(fullReport, null, 2));

  console.log('FINAL_HELD_OUT_TEST_COMPLETE:');
  console.log(JSON.stringify(fullReport.testEvaluation, null, 2));
}

main().catch((err) => {
  console.error('Final held-out evaluation failed:', err);
  process.exit(1);
});
