import fs from 'fs';
import { PATHS } from '../server/config/constants.js';
import { validateAndInspectDataset, getDatasetStats } from '../server/ml/datasetLoader.js';
import { runTraining, trainingState } from '../server/ml/train.js';

async function main() {
  const stats = getDatasetStats();
  console.log('Current dataset stats:', {
    extractedImagesCount: stats.extractedImagesCount,
    metadataDownloaded: stats.metadataDownloaded,
    zipDownloaded: stats.zipDownloaded,
  });

  console.log('1/2 Running PAD-UFES-20 validation and patient-grouped 70/15/15 split generation...');
  const report = await validateAndInspectDataset();
  console.log('Validation summary:', {
    usableRecordsCount: report.usableRecordsCount,
    patientCount: report.patientCount,
    lesionCount: report.lesionCount,
    leakageVerified: report.leakageVerified,
    classDistribution: report.classDistribution,
    splitSummary: report.splitSummary,
  });

  if (!report.datasetReady) {
    throw new Error('Dataset is not ready for training after validation.');
  }

  const epochs = Number(process.env.EPOCHS || 10);
  const batchSize = Number(process.env.BATCH_SIZE || 8);
  const imageSize = Number(process.env.IMAGE_SIZE || 160);
  const resume = fs.existsSync(`${PATHS.latestCheckpointDir}/model.json`);

  console.log(
    `2/2 ${resume ? 'Resuming' : 'Starting'} TensorFlow.js CNN training (${epochs} epochs, batchSize=${batchSize}, imageSize=${imageSize})...`
  );

  const progressTimer = setInterval(() => {
    const rssMb = Math.round(process.memoryUsage().rss / 1048576);
    console.log(
      `[TRAIN] status=${trainingState.status} epoch=${trainingState.currentEpoch}/${trainingState.totalEpochs} batch=${trainingState.currentBatch}/${trainingState.totalBatches} loss=${trainingState.trainLoss} acc=${trainingState.trainAccuracy} val_loss=${trainingState.valLoss} val_acc=${trainingState.valAccuracy} rss=${rssMb}MB`
    );
  }, 15000);
  progressTimer.unref();

  const result = await runTraining({
    epochs,
    batchSize,
    imageSize,
    learningRate: 0.0005,
    earlyStoppingPatience: 4,
    resume,
  });

  clearInterval(progressTimer);

  // Free temporary raw RGB cache after training & evaluation complete
  try {
    fs.rmSync(PATHS.processedCache, { recursive: true, force: true });
    console.log('Cleaned temporary cache_192 directory to preserve container memory.');
  } catch {
    // ignore
  }

  console.log(
    'TRAINING_COMPLETE:',
    JSON.stringify(
      {
        epochsCompleted: result.modelConfig.trainingConfig.epochsCompleted,
        bestEpoch: result.modelConfig.trainingConfig.bestEpoch,
        durationMs: result.modelConfig.durationMs,
        evaluation: result.evaluation,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('ML pipeline failed:', err);
  process.exit(1);
});
