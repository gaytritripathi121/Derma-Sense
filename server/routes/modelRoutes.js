import express from 'express';
import {
  CLASS_CODES,
  CLASS_NAMES,
  DEFAULT_TRAINING_CONFIG,
  MENDELEY_DATASET_INFO,
} from '../config/constants.js';
import {
  getActiveEvaluationMetrics,
  getActiveModelConfig,
  getAvailableModelPath,
  isSelectedModelAvailable,
} from '../ml/model.js';
import { trainingState } from '../ml/train.js';
import { loadRules } from '../rules/ruleEngine.js';

const router = express.Router();

router.get('/metrics', (req, res) => {
  const evaluation = getActiveEvaluationMetrics();
  const modelConfig = getActiveModelConfig();
  const availableModelPath = getAvailableModelPath();

  res.json({
    modelAvailable: Boolean(availableModelPath),
    selectedModelActive: isSelectedModelAvailable(),
    evaluationAvailable: Boolean(evaluation),
    evaluation,
    modelConfig,
    trainingHistory: trainingState.history || [],
    trainingStatus: trainingState.status,
    classMapping: CLASS_CODES.map((code, idx) => ({
      index: idx,
      code,
      fullName: CLASS_NAMES[code],
    })),
    defaults: DEFAULT_TRAINING_CONFIG,
    datasetSource: MENDELEY_DATASET_INFO,
  });
});

router.get('/rules', (req, res, next) => {
  try {
    const rules = loadRules();
    res.json({
      engineType: 'Independent Heuristic Rule Engine (JSON Knowledge Base)',
      note: 'These rules execute independently of CNN inference, do not alter model probabilities, and are not SHAP explanations.',
      rules,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
