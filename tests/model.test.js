import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { getTF } from '../server/ml/tfBackend.js';
import {
  buildDermaSenseCNN,
  getActiveEvaluationMetrics,
  getActiveModelConfig,
  getAvailableModelPath,
  isSelectedModelAvailable,
  loadActiveModel,
} from '../server/ml/model.js';
import { generateGradCAM } from '../server/ml/gradcam.js';
import { evaluateConfidence } from '../server/safety/confidence.js';
import { assessImageQuality } from '../server/safety/imageQuality.js';

test('DermaSense CNN architecture builds 6-class softmax output and computes genuine Grad-CAM', async () => {
  const { tf } = await getTF();
  const model = buildDermaSenseCNN(tf, { imageSize: 192 });
  assert.equal(model.outputShape[1], 6);

  const imgBuf = await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 3,
      background: { r: 165, g: 110, b: 95 },
    },
  })
    .png()
    .toBuffer();

  const quality = await assessImageQuality(imgBuf, 'synthetic.png', 'image/png');
  assert.equal(quality.valid, true);

  const x = tf.randomUniform([1, 192, 192, 3]);
  const preds = model.predict(x);
  const probs = Array.from(await preds.data());
  assert.equal(probs.length, 6);

  const sum = probs.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-3);

  const gradcam = await generateGradCAM(tf, model, x, imgBuf, 0);
  assert.equal(gradcam.layerName, 'gradcam_target_relu');
  assert.ok(gradcam.originalBase64.startsWith('data:image/png;base64,'));
  assert.ok(gradcam.heatmapBase64.startsWith('data:image/png;base64,'));
  assert.ok(gradcam.overlayBase64.startsWith('data:image/png;base64,'));

  tf.dispose([x, preds, model]);
});

test('Selected MobileNetV2 offline model loads locally and produces 6-class prediction and Grad-CAM', async () => {
  assert.equal(isSelectedModelAvailable(), true);
  const activeDir = getAvailableModelPath();
  assert.ok(activeDir.endsWith('selectedModel'));

  const cfg = getActiveModelConfig();
  assert.equal(cfg.modelType, 'mobilenet_v2_hybrid');
  assert.equal(cfg.preprocessing.imageSize, 224);

  const metrics = getActiveEvaluationMetrics();
  assert.equal(metrics.testSampleCount, 344);
  assert.ok(metrics.accuracy > 0.5);

  const { tf } = await getTF();
  const activeModel = await loadActiveModel(tf, activeDir);
  assert.equal(activeModel.kind, 'mobilenet_v2_hybrid');

  const imgBuf = await sharp({
    create: {
      width: 224,
      height: 224,
      channels: 3,
      background: { r: 155, g: 105, b: 90 },
    },
  })
    .png()
    .toBuffer();

  const x = tf.randomUniform([1, 224, 224, 3]);
  const predT = tf.tidy(() => {
    const conv = activeModel.backbone.execute(x, activeModel.convNode);
    return activeModel.head.predict(conv.mean([1, 2]));
  });
  const probs = Array.from(await predT.data());
  assert.equal(probs.length, 6);
  assert.ok(Math.abs(probs.reduce((a, b) => a + b, 0) - 1) < 1e-3);

  const gradcam = await generateGradCAM(tf, activeModel, x, imgBuf, 0);
  assert.equal(gradcam.layerName, 'module_apply_default/MobilenetV2/Conv_1/Relu6');
  assert.deepEqual(gradcam.featureMapShape, [7, 7]);
  assert.ok(gradcam.overlayBase64.startsWith('data:image/png;base64,'));

  predT.dispose();
  x.dispose();
  activeModel.dispose();
});

test('evaluateConfidence triggers LOW_CONFIDENCE below 70% threshold', () => {
  const low = evaluateConfidence([0.45, 0.25, 0.1, 0.1, 0.05, 0.05], 0.7);
  assert.equal(low.isLowConfidence, true);
  assert.equal(low.status, 'LOW_CONFIDENCE');

  const high = evaluateConfidence([0.85, 0.05, 0.04, 0.03, 0.02, 0.01], 0.7);
  assert.equal(high.isLowConfidence, false);
  assert.equal(high.status, 'STANDARD_CONFIDENCE');
});
