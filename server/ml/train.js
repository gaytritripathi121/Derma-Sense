import fs from 'fs';
import path from 'path';
import {
  CLASS_CODES,
  DEFAULT_TRAINING_CONFIG,
  MENDELEY_DATASET_INFO,
  PATHS,
} from '../config/constants.js';
import { getTF } from './tfBackend.js';
import {
  buildDermaSenseCNN,
  createWeightedCrossEntropyLoss,
  loadModelFromDir,
  saveModelToDir,
  summarizeModelArchitecture,
} from './model.js';
import { ensurePreprocessedCache, loadBatchTensors, PREPROCESSING_CONFIG } from './preprocessing.js';
import { evaluateModelOnSplit } from './evaluate.js';

export const trainingState = {
  status: 'not_started',
  currentEpoch: 0,
  totalEpochs: DEFAULT_TRAINING_CONFIG.epochs,
  currentBatch: 0,
  totalBatches: 0,
  trainLoss: null,
  valLoss: null,
  trainAccuracy: null,
  valAccuracy: null,
  bestValLoss: null,
  bestValAccuracy: null,
  bestEpoch: null,
  batchSize: DEFAULT_TRAINING_CONFIG.batchSize,
  imageSize: DEFAULT_TRAINING_CONFIG.imageSize,
  learningRate: DEFAULT_TRAINING_CONFIG.learningRate,
  backendMode: '',
  startedAt: null,
  completedAt: null,
  durationMs: 0,
  history: [],
  logs: [],
  error: null,
  stopRequested: false,
};

(function hydrateTrainingState() {
  if (fs.existsSync(PATHS.trainingStateFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(PATHS.trainingStateFile, 'utf8'));
      Object.assign(trainingState, saved);
      if (trainingState.status === 'training' || trainingState.status === 'preparing') {
        trainingState.status = 'interrupted';
      }
      trainingState.stopRequested = false;
    } catch {
      // ignore
    }
  }
})();

function persistState() {
  fs.mkdirSync(path.dirname(PATHS.trainingStateFile), { recursive: true });
  const copy = { ...trainingState };
  delete copy.stopRequested;
  fs.writeFileSync(PATHS.trainingStateFile, JSON.stringify(copy, null, 2));
}

function logTraining(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  trainingState.logs.push(line);
  if (trainingState.logs.length > 300) trainingState.logs.shift();
}

function computeClassWeights(trainRecords) {
  const counts = Array(CLASS_CODES.length).fill(0);
  for (const r of trainRecords) counts[r.labelIndex]++;
  const total = trainRecords.length;
  const numClasses = CLASS_CODES.length;
  return counts.map((c) => {
    if (c === 0) return 1.0;
    const raw = total / (numClasses * c);
    return Number(Math.min(6.0, Math.max(0.4, raw)).toFixed(4));
  });
}

function shuffleWithSeed(arr, seed) {
  const out = [...arr];
  let s = seed;
  const rand = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function evaluateValidationEpoch(tf, model, valRecords, imageSize, batchSize) {
  let lossSum = 0;
  let correct = 0;
  let total = 0;

  for (let i = 0; i < valRecords.length; i += batchSize) {
    const slice = valRecords.slice(i, i + batchSize);
    const { xs, ys } = await loadBatchTensors(tf, slice, imageSize, { augment: false });
    const evalOut = model.evaluate(xs, ys, { batchSize: slice.length });
    const lossVal = (await evalOut[0].data())[0];
    const accVal = (await evalOut[1].data())[0];
    tf.dispose([xs, ys, ...evalOut]);

    lossSum += lossVal * slice.length;
    correct += accVal * slice.length;
    total += slice.length;
  }

  return {
    valLoss: total > 0 ? Number((lossSum / total).toFixed(4)) : 0,
    valAccuracy: total > 0 ? Number((correct / total).toFixed(4)) : 0,
  };
}

export async function runTraining({
  epochs = DEFAULT_TRAINING_CONFIG.epochs,
  batchSize = DEFAULT_TRAINING_CONFIG.batchSize,
  imageSize = DEFAULT_TRAINING_CONFIG.imageSize,
  learningRate = DEFAULT_TRAINING_CONFIG.learningRate,
  earlyStoppingPatience = DEFAULT_TRAINING_CONFIG.earlyStoppingPatience,
  resume = false,
} = {}) {
  if (trainingState.status === 'training' || trainingState.status === 'preparing') {
    return { started: false, message: 'Training is already active.', state: trainingState };
  }

  if (!fs.existsSync(PATHS.splitsFile)) {
    throw new Error('Dataset splits not found. Download, extract, and validate PAD-UFES-20 first.');
  }

  const splitsJson = JSON.parse(fs.readFileSync(PATHS.splitsFile, 'utf8'));
  const trainRecords = splitsJson.splits?.train || [];
  const valRecords = splitsJson.splits?.val || [];
  const testRecords = splitsJson.splits?.test || [];

  if (trainRecords.length < 10 || valRecords.length < 2 || testRecords.length < 2) {
    throw new Error('Insufficient validated records in splits to run training.');
  }

  trainingState.stopRequested = false;
  trainingState.error = null;
  trainingState.status = 'preparing';
  trainingState.totalEpochs = epochs;
  trainingState.batchSize = batchSize;
  trainingState.imageSize = imageSize;
  trainingState.learningRate = learningRate;

  if (!resume) {
    trainingState.currentEpoch = 0;
    trainingState.history = [];
    trainingState.bestValLoss = null;
    trainingState.bestValAccuracy = null;
    trainingState.bestEpoch = null;
    trainingState.logs = [];
    trainingState.startedAt = new Date().toISOString();
    trainingState.completedAt = null;
    trainingState.durationMs = 0;
  }

  const startEpoch = resume ? trainingState.currentEpoch : 0;
  logTraining(
    `${resume ? 'Resuming' : 'Starting'} PAD-UFES-20 CNN training (${trainRecords.length} train, ${valRecords.length} val, ${testRecords.length} test).`
  );
  persistState();

  try {
    const { tf, backendMode } = await getTF();
    trainingState.backendMode = backendMode;
    logTraining(`TensorFlow.js backend ready: ${backendMode}`);

    const allRecords = [...trainRecords, ...valRecords, ...testRecords];
    logTraining(`Preparing ${imageSize}x${imageSize} RGB preprocessed cache...`);
    await ensurePreprocessedCache(allRecords, imageSize, (done, tot) => {
      if (done === tot || done % 400 === 0) {
        logTraining(`Preprocessed ${done}/${tot} images.`);
      }
    });

    const classWeights = computeClassWeights(trainRecords);
    logTraining(`Class weights (ACK, BCC, MEL, NEV, SCC, SEK): ${classWeights.join(', ')}`);

    let model;
    if (resume && fs.existsSync(path.join(PATHS.latestCheckpointDir, 'model.json'))) {
      logTraining('Loading latest training checkpoint to resume...');
      model = await loadModelFromDir(tf, PATHS.latestCheckpointDir);
    } else {
      model = buildDermaSenseCNN(tf, { imageSize });
    }

    const weightedLoss = createWeightedCrossEntropyLoss(tf, classWeights);
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: weightedLoss,
      metrics: ['accuracy'],
    });

    const archSummary = summarizeModelArchitecture(model);
    logTraining(`Compiled ${archSummary.name} (${archSummary.totalParams} parameters).`);

    trainingState.status = 'training';
    const totalBatches = Math.ceil(trainRecords.length / batchSize);
    trainingState.totalBatches = totalBatches;
    persistState();

    const runStartedMs = Date.now() - (resume ? trainingState.durationMs : 0);
    let epochsWithoutImprovement = 0;

    for (let epoch = startEpoch + 1; epoch <= epochs; epoch++) {
      if (trainingState.stopRequested) {
        trainingState.status = 'interrupted';
        logTraining(`Training stopped safely before epoch ${epoch}. Checkpoint preserved.`);
        persistState();
        return { stopped: true, state: trainingState };
      }

      trainingState.currentEpoch = epoch;
      const shuffledTrain = shuffleWithSeed(trainRecords, DEFAULT_TRAINING_CONFIG.seed + epoch);
      let epochLossSum = 0;
      let epochAccSum = 0;
      let sampleCount = 0;

      for (let b = 0; b < totalBatches; b++) {
        if (trainingState.stopRequested) {
          await saveModelToDir(tf, model, PATHS.latestCheckpointDir);
          trainingState.status = 'interrupted';
          trainingState.durationMs = Date.now() - runStartedMs;
          logTraining(`Training interrupted safely at epoch ${epoch}, batch ${b}/${totalBatches}.`);
          persistState();
          return { stopped: true, state: trainingState };
        }

        const slice = shuffledTrain.slice(b * batchSize, (b + 1) * batchSize);
        const { xs, ys } = await loadBatchTensors(tf, slice, imageSize, { augment: true });
        const result = await model.trainOnBatch(xs, ys);
        tf.dispose([xs, ys]);

        const bLoss = Array.isArray(result) ? result[0] : result;
        const bAcc = Array.isArray(result) ? result[1] : 0;

        epochLossSum += bLoss * slice.length;
        epochAccSum += bAcc * slice.length;
        sampleCount += slice.length;
        trainingState.currentBatch = b + 1;
        trainingState.trainLoss = Number((epochLossSum / sampleCount).toFixed(4));
        trainingState.trainAccuracy = Number((epochAccSum / sampleCount).toFixed(4));
        trainingState.durationMs = Date.now() - runStartedMs;
      }

      const { valLoss, valAccuracy } = await evaluateValidationEpoch(
        tf,
        model,
        valRecords,
        imageSize,
        batchSize
      );

      const trainLoss = Number((epochLossSum / sampleCount).toFixed(4));
      const trainAccuracy = Number((epochAccSum / sampleCount).toFixed(4));

      trainingState.trainLoss = trainLoss;
      trainingState.trainAccuracy = trainAccuracy;
      trainingState.valLoss = valLoss;
      trainingState.valAccuracy = valAccuracy;
      trainingState.durationMs = Date.now() - runStartedMs;

      trainingState.history.push({
        epoch,
        trainLoss,
        valLoss,
        trainAccuracy,
        valAccuracy,
      });

      await saveModelToDir(tf, model, PATHS.latestCheckpointDir);

      const improved =
        trainingState.bestValLoss === null || valLoss < trainingState.bestValLoss;
      if (improved) {
        trainingState.bestValLoss = valLoss;
        trainingState.bestValAccuracy = valAccuracy;
        trainingState.bestEpoch = epoch;
        epochsWithoutImprovement = 0;
        await saveModelToDir(tf, model, PATHS.bestCheckpointDir);
        logTraining(
          `Epoch ${epoch}/${epochs} — loss: ${trainLoss}, acc: ${(trainAccuracy * 100).toFixed(1)}%, val_loss: ${valLoss}, val_acc: ${(valAccuracy * 100).toFixed(1)}% [Best checkpoint saved]`
        );
      } else {
        epochsWithoutImprovement++;
        logTraining(
          `Epoch ${epoch}/${epochs} — loss: ${trainLoss}, acc: ${(trainAccuracy * 100).toFixed(1)}%, val_loss: ${valLoss}, val_acc: ${(valAccuracy * 100).toFixed(1)}%`
        );
      }

      persistState();

      if (epochsWithoutImprovement >= earlyStoppingPatience) {
        logTraining(
          `Early stopping triggered after ${earlyStoppingPatience} epochs without validation loss improvement.`
        );
        break;
      }

      if (typeof global.gc === 'function') {
        global.gc();
      }
    }

    const bestModel = fs.existsSync(path.join(PATHS.bestCheckpointDir, 'model.json'))
      ? await loadModelFromDir(tf, PATHS.bestCheckpointDir)
      : model;

    await saveModelToDir(tf, bestModel, PATHS.trainedModelDir);
    logTraining('Evaluating best checkpoint on held-out 15% test split...');

    const evaluation = await evaluateModelOnSplit(tf, bestModel, testRecords, imageSize, batchSize);
    logTraining(
      `Held-out test results — Accuracy: ${(evaluation.accuracy * 100).toFixed(2)}%, Macro-F1: ${(evaluation.macroF1 * 100).toFixed(2)}%`
    );

    const modelConfig = {
      modelVersion: DEFAULT_TRAINING_CONFIG.modelVersion,
      architecture: archSummary,
      trainedAt: new Date().toISOString(),
      datasetSource: MENDELEY_DATASET_INFO.sourcePage,
      classMapping: Object.fromEntries(CLASS_CODES.map((c, i) => [i, c])),
      preprocessing: { ...PREPROCESSING_CONFIG, imageSize },
      trainingConfig: {
        epochsRequested: epochs,
        epochsCompleted: trainingState.currentEpoch,
        bestEpoch: trainingState.bestEpoch,
        batchSize,
        learningRate,
        optimizer: 'Adam',
        loss: 'Class-Weighted Categorical Cross-Entropy',
        classWeights,
        earlyStoppingPatience,
        seed: DEFAULT_TRAINING_CONFIG.seed,
        confidenceThreshold: DEFAULT_TRAINING_CONFIG.confidenceThreshold,
        backendMode,
      },
      splitSummary: splitsJson.summary,
      durationMs: trainingState.durationMs,
    };

    fs.writeFileSync(PATHS.modelConfigFile, JSON.stringify(modelConfig, null, 2));

    trainingState.status = 'completed';
    trainingState.completedAt = new Date().toISOString();
    persistState();

    tf.dispose([model, bestModel]);

    return { completed: true, state: trainingState, evaluation, modelConfig };
  } catch (err) {
    trainingState.status = 'error';
    trainingState.error = err.message;
    logTraining(`Training failed: ${err.message}`);
    persistState();
    throw err;
  }
}

export function requestStopTraining() {
  if (trainingState.status === 'training' || trainingState.status === 'preparing') {
    trainingState.stopRequested = true;
    trainingState.status = 'stopping';
    logTraining('Stop signal received. Finishing current batch safely...');
    persistState();
    return { stopping: true, state: trainingState };
  }
  return { stopping: false, message: 'No active training job is running.', state: trainingState };
}
