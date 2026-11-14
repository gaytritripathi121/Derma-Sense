import crypto from 'crypto';
import {
  CLASS_CODES,
  CLASS_MAPPING,
  CLASS_NAMES,
  DEFAULT_TRAINING_CONFIG,
} from '../config/constants.js';
import { getTF } from './tfBackend.js';
import { getActiveModelConfig, getAvailableModelPath, loadActiveModel } from './model.js';
import { preprocessImageToFloat32 } from './preprocessing.js';
import { generateGradCAM } from './gradcam.js';
import { assessImageQuality } from '../safety/imageQuality.js';
import { evaluateConfidence } from '../safety/confidence.js';
import { evaluatePatientContext } from '../rules/ruleEngine.js';

let cachedModel = null;
let cachedModelPath = null;

export function clearCachedInferenceModel() {
  if (cachedModel) {
    try {
      cachedModel.dispose();
    } catch {
      // ignore
    }
  }
  cachedModel = null;
  cachedModelPath = null;
}

export async function runPrediction({
  imageBuffer,
  originalName = 'upload.png',
  mimetype = 'image/png',
  patientHistory = {},
  confidenceThreshold = DEFAULT_TRAINING_CONFIG.confidenceThreshold,
}) {
  const modelDir = getAvailableModelPath();
  if (!modelDir) {
    const err = new Error(
      'Trained CNN model is unavailable. Complete PAD-UFES-20 dataset validation and model training before running predictions.'
    );
    err.statusCode = 503;
    throw err;
  }

  const quality = await assessImageQuality(imageBuffer, originalName, mimetype);
  if (!quality.valid) {
    const err = new Error(quality.errors.join(' '));
    err.statusCode = 400;
    err.quality = quality;
    throw err;
  }

  const modelConfig = getActiveModelConfig();
  const imageSize = modelConfig?.preprocessing?.imageSize || DEFAULT_TRAINING_CONFIG.imageSize;
  const modelVersion = modelConfig?.modelVersion || DEFAULT_TRAINING_CONFIG.modelVersion;

  const { tf, backendMode } = await getTF();
  if (!cachedModel || cachedModelPath !== modelDir) {
    clearCachedInferenceModel();
    cachedModel = await loadActiveModel(tf, modelDir);
    cachedModelPath = modelDir;
  }

  const floatPixels = await preprocessImageToFloat32(imageBuffer, imageSize);
  const inputTensor = tf.tensor4d(floatPixels, [1, imageSize, imageSize, 3]);

  let probabilities;
  let gradcam;
  try {
    const predTensor = tf.tidy(() => {
      if (cachedModel.kind === 'mobilenet_v2_hybrid') {
        const convMap = cachedModel.backbone.execute(inputTensor, cachedModel.convNode);
        const pooled = convMap.mean([1, 2]);
        return cachedModel.head.predict(pooled);
      }
      return cachedModel.predict(inputTensor);
    });
    const rawProbs = await predTensor.data();
    predTensor.dispose();
    probabilities = Array.from(rawProbs).map((v) => Number(v.toFixed(6)));

    const confidenceEval = evaluateConfidence(probabilities, confidenceThreshold);
    const predictedIdx = confidenceEval.maxIndex;
    const predictedCode = CLASS_MAPPING[predictedIdx];

    gradcam = await generateGradCAM(
      tf,
      cachedModel,
      inputTensor,
      imageBuffer,
      predictedIdx
    );

    const distribution = CLASS_CODES.map((code, idx) => ({
      code,
      fullName: CLASS_NAMES[code],
      probability: probabilities[idx],
      percentage: Number((probabilities[idx] * 100).toFixed(2)),
    })).sort((a, b) => b.probability - a.probability);

    const contextualAssessment = evaluatePatientContext(patientHistory);

    const reportId = `DS-${Date.now().toString(36).toUpperCase()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    return {
      reportId,
      analyzedAt: new Date().toISOString(),
      modelVersion,
      backendMode,
      predictedClass: predictedCode,
      fullCategoryName: CLASS_NAMES[predictedCode],
      confidence: confidenceEval.maxProb,
      confidencePercentage: Number((confidenceEval.maxProb * 100).toFixed(2)),
      confidenceAssessment: confidenceEval,
      topThree: distribution.slice(0, 3),
      allProbabilities: distribution,
      imageQuality: quality,
      gradcam,
      patientHistory,
      contextualAssessment,
      disclaimer:
        'DermaSense AI is an experimental academic screening tool. Predictions are preliminary, raw model confidence is not confirmed diagnostic probability, and a benign-looking result never rules out skin cancer. Consult a qualified dermatologist.',
    };
  } finally {
    inputTensor.dispose();
  }
}
