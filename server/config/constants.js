import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, '../..');

export const PATHS = {
  dataRaw: path.join(ROOT_DIR, 'data/raw'),
  dataProcessed: path.join(ROOT_DIR, 'data/processed'),
  processedCache: path.join(ROOT_DIR, 'data/processed/cache_192'),
  splitsFile: path.join(ROOT_DIR, 'data/processed/splits.json'),
  validationReportFile: path.join(ROOT_DIR, 'data/processed/validation_report.json'),
  modelsDir: path.join(ROOT_DIR, 'models'),
  selectedModelDir: path.join(ROOT_DIR, 'models/selectedModel'),
  selectedModelConfigFile: path.join(ROOT_DIR, 'models/selectedModel/modelConfig.json'),
  selectedMetricsFile: path.join(ROOT_DIR, 'models/selectedModel/evaluation.json'),
  trainedModelDir: path.join(ROOT_DIR, 'models/trainedModel'),
  bestCheckpointDir: path.join(ROOT_DIR, 'models/checkpoints/best_model'),
  latestCheckpointDir: path.join(ROOT_DIR, 'models/checkpoints/latest_checkpoint'),
  trainingStateFile: path.join(ROOT_DIR, 'models/checkpoints/training_state.json'),
  modelConfigFile: path.join(ROOT_DIR, 'models/modelConfig.json'),
  outputsDir: path.join(ROOT_DIR, 'outputs'),
  metricsFile: path.join(ROOT_DIR, 'outputs/metrics/evaluation.json'),
  logsDir: path.join(ROOT_DIR, 'outputs/logs'),
  reportsDir: path.join(ROOT_DIR, 'outputs/reports'),
  tmpDir: path.join(ROOT_DIR, 'tmp'),
};

export const CLASS_MAPPING = {
  0: 'ACK',
  1: 'BCC',
  2: 'MEL',
  3: 'NEV',
  4: 'SCC',
  5: 'SEK',
};

export const CLASS_CODES = ['ACK', 'BCC', 'MEL', 'NEV', 'SCC', 'SEK'];

export const CODE_TO_INDEX = {
  ACK: 0,
  BCC: 1,
  MEL: 2,
  NEV: 3,
  SCC: 4,
  SEK: 5,
};

export const CLASS_NAMES = {
  ACK: 'Actinic keratosis',
  BCC: 'Basal cell carcinoma',
  MEL: 'Melanoma',
  NEV: 'Nevus',
  SCC: 'Squamous cell carcinoma',
  SEK: 'Seborrheic keratosis',
};

export const DEFAULT_TRAINING_CONFIG = {
  imageSize: 192,
  batchSize: 16,
  epochs: 20,
  learningRate: 0.0005,
  earlyStoppingPatience: 5,
  seed: 42,
  confidenceThreshold: 0.7,
  architectureName: 'DermaNet-DSConv-v1 (Depthwise Separable CNN)',
  modelVersion: '1.0.0',
};

export const MENDELEY_DATASET_INFO = {
  datasetId: 'zr7vgbcyr2',
  version: 1,
  sourcePage: 'https://data.mendeley.com/datasets/zr7vgbcyr2/1',
  githubRepo: 'https://github.com/labcin-ufes/PAD-UFES-20',
  zipApiUrl: 'https://data.mendeley.com/public-api/zip/zr7vgbcyr2/download/1',
  metadataFileUrl:
    'https://data.mendeley.com/public-files/datasets/zr7vgbcyr2/files/fa850265-57da-48f0-ba3e-998b3e44b1f6/file_downloaded',
};
