import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PATHS } from '../server/config/constants.js';

const LOG_FILE = 'experiments/pipeline_master.log';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

function runSubprocess(label, args) {
  log(`>>> Starting stage: ${label}`);
  const res = spawnSync(process.execPath, ['--expose-gc', '--max-old-space-size=512', ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`Stage "${label}" exited with status ${res.status} (signal=${res.signal || 'none'})`);
  }
  log(`<<< Completed stage: ${label}`);
}

async function main() {
  fs.mkdirSync('experiments', { recursive: true });
  log('=== DermaSense AI Master Recovery & Experimentation Runner ===');

  const imagesDir = path.join(PATHS.dataRaw, 'images');
  const existingImages = fs.existsSync(imagesDir)
    ? fs.readdirSync(imagesDir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).length
    : 0;

  if (existingImages < 2298 || !fs.existsSync(PATHS.splitsFile)) {
    runSubprocess('PAD-UFES-20 Download, Extraction & Validation', [
      '-e',
      `import { downloadOfficialDataset, validateAndInspectDataset } from './server/ml/datasetLoader.js';
       await downloadOfficialDataset();
       const report = await validateAndInspectDataset();
       console.log('Validated usable:', report.usableRecordsCount, 'leakageVerified:', report.leakageVerified);`,
    ]);
  } else {
    log(`Dataset already present (${existingImages} images + splits.json). Skipping download.`);
  }

  if (
    !fs.existsSync(path.join(PATHS.trainedModelDir, 'model.json')) ||
    !fs.existsSync(PATHS.metricsFile)
  ) {
    runSubprocess('Restore Original Baseline Model (DermaNet_DSConv_6Class)', [
      'scripts/run-ml-pipeline.js',
    ]);
  } else {
    log('Original baseline model & evaluation already preserved. Skipping.');
  }

  if (!fs.existsSync('experiments/exp_c_mobilenetv1_finetune/result.json')) {
    runSubprocess('Experiment C: MobileNetV1 Two-Phase Fine-Tuning', [
      'experiments/run_exp_c_mobilenetv1_finetune.js',
    ]);
  } else {
    log('Experiment C result already exists. Skipping.');
  }

  if (!fs.existsSync('experiments/exp_a_custom_cnn/result.json')) {
    runSubprocess('Experiment A: DermaNet_DeepRes_v2 Custom Residual CNN', [
      'experiments/run_exp_a_custom_cnn.js',
    ]);
  } else {
    log('Experiment A result already exists. Skipping.');
  }

  log('=== ALL TRAINING EXPERIMENTS COMPLETE ===');
}

main().catch((err) => {
  log(`MASTER_PIPELINE_FAILED: ${err.message}`);
  process.exit(1);
});
