import fs from 'fs';
import path from 'path';
import { CLASS_CODES, DEFAULT_TRAINING_CONFIG, PATHS } from '../config/constants.js';

export function buildDermaSenseCNN(tf, config = {}) {
  const imageSize = config.imageSize || DEFAULT_TRAINING_CONFIG.imageSize;
  const numClasses = CLASS_CODES.length;

  const input = tf.input({ shape: [imageSize, imageSize, 3], name: 'lesion_image_input' });

  let x = tf.layers
    .conv2d({
      filters: 24,
      kernelSize: 3,
      strides: 2,
      padding: 'same',
      useBias: false,
      kernelInitializer: 'heNormal',
      name: 'stem_conv',
    })
    .apply(input);
  x = tf.layers.batchNormalization({ name: 'stem_bn' }).apply(x);
  x = tf.layers.reLU({ name: 'stem_relu' }).apply(x);

  x = tf.layers
    .separableConv2d({
      filters: 48,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      depthwiseInitializer: 'heNormal',
      pointwiseInitializer: 'heNormal',
      name: 'sep_conv_1',
    })
    .apply(x);
  x = tf.layers.batchNormalization({ name: 'bn_1' }).apply(x);
  x = tf.layers.reLU({ name: 'relu_1' }).apply(x);
  x = tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: 'pool_1' }).apply(x);

  x = tf.layers
    .separableConv2d({
      filters: 96,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      depthwiseInitializer: 'heNormal',
      pointwiseInitializer: 'heNormal',
      name: 'sep_conv_2',
    })
    .apply(x);
  x = tf.layers.batchNormalization({ name: 'bn_2' }).apply(x);
  x = tf.layers.reLU({ name: 'relu_2' }).apply(x);
  x = tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: 'pool_2' }).apply(x);

  x = tf.layers
    .separableConv2d({
      filters: 128,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      depthwiseInitializer: 'heNormal',
      pointwiseInitializer: 'heNormal',
      name: 'sep_conv_3',
    })
    .apply(x);
  x = tf.layers.batchNormalization({ name: 'bn_3' }).apply(x);
  x = tf.layers.reLU({ name: 'relu_3' }).apply(x);
  x = tf.layers.maxPooling2d({ poolSize: 2, strides: 2, name: 'pool_3' }).apply(x);

  x = tf.layers
    .conv2d({
      filters: 160,
      kernelSize: 3,
      padding: 'same',
      useBias: false,
      kernelInitializer: 'heNormal',
      name: 'gradcam_target_conv',
    })
    .apply(x);
  x = tf.layers.batchNormalization({ name: 'gradcam_target_bn' }).apply(x);
  x = tf.layers.reLU({ name: 'gradcam_target_relu' }).apply(x);

  x = tf.layers.globalAveragePooling2d({ name: 'global_avg_pool' }).apply(x);
  x = tf.layers.dropout({ rate: 0.35, name: 'dropout_1' }).apply(x);
  x = tf.layers
    .dense({
      units: 64,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'dense_head',
    })
    .apply(x);
  x = tf.layers.dropout({ rate: 0.25, name: 'dropout_2' }).apply(x);
  const logits = tf.layers
    .dense({
      units: numClasses,
      kernelInitializer: 'glorotUniform',
      name: 'logits',
    })
    .apply(x);
  const predictions = tf.layers
    .activation({
      activation: 'softmax',
      name: 'predictions',
    })
    .apply(logits);

  return tf.model({
    inputs: input,
    outputs: predictions,
    name: 'DermaNet_DSConv_6Class',
  });
}

export function createWeightedCrossEntropyLoss(tf, classWeightsArray) {
  const weightsTensor = tf.tensor1d(classWeightsArray, 'float32');
  return (yTrue, yPred) =>
    tf.tidy(() => {
      const eps = 1e-7;
      const clipped = tf.clipByValue(yPred, eps, 1 - eps);
      const logPreds = tf.log(clipped);
      const perClassLoss = tf.mul(yTrue, logPreds).neg();
      const weighted = tf.mul(perClassLoss, weightsTensor);
      return tf.mean(tf.sum(weighted, -1));
    });
}

export async function saveModelToDir(tf, model, dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  try {
    await model.save(`file://${dirPath}`);
    return;
  } catch {
    await model.save(
      tf.io.withSaveHandler(async (artifacts) => {
        const modelJson = {
          modelTopology: artifacts.modelTopology,
          format: artifacts.format || 'layers-model',
          generatedBy: 'TensorFlow.js DermaSense AI',
          convertedBy: null,
          weightsManifest: [
            {
              paths: ['weights.bin'],
              weights: artifacts.weightSpecs,
            },
          ],
        };
        fs.writeFileSync(path.join(dirPath, 'model.json'), JSON.stringify(modelJson));
        const weightBuf = Buffer.from(artifacts.weightData);
        fs.writeFileSync(path.join(dirPath, 'weights.bin'), weightBuf);
        return {
          modelArtifactsInfo: {
            dateSaved: new Date(),
            modelTopologyType: 'JSON',
            weightDataBytes: weightBuf.byteLength,
          },
        };
      })
    );
  }
}

export async function loadModelFromDir(tf, dirPath) {
  const modelJsonPath = path.join(dirPath, 'model.json');
  if (!fs.existsSync(modelJsonPath)) {
    throw new Error(`Model file not found at ${modelJsonPath}`);
  }
  try {
    return await tf.loadLayersModel(`file://${modelJsonPath}`);
  } catch {
    return await tf.loadLayersModel(
      tf.io.fromMemory(
        (() => {
          const parsed = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
          const weightSpecs = parsed.weightsManifest?.[0]?.weights || [];
          const weightPaths = parsed.weightsManifest?.[0]?.paths || ['weights.bin'];
          const buffers = weightPaths.map((p) => fs.readFileSync(path.join(dirPath, p)));
          const combined = Buffer.concat(buffers);
          const weightData = combined.buffer.slice(
            combined.byteOffset,
            combined.byteOffset + combined.byteLength
          );
          return {
            modelTopology: parsed.modelTopology,
            weightSpecs,
            weightData,
          };
        })()
      )
    );
  }
}

export function isSelectedModelAvailable() {
  return (
    fs.existsSync(path.join(PATHS.selectedModelDir, 'backbone/model.json')) &&
    fs.existsSync(path.join(PATHS.selectedModelDir, 'head/model.json'))
  );
}

export function getAvailableModelPath() {
  if (isSelectedModelAvailable()) return PATHS.selectedModelDir;
  const bestJson = path.join(PATHS.bestCheckpointDir, 'model.json');
  const trainedJson = path.join(PATHS.trainedModelDir, 'model.json');
  if (fs.existsSync(trainedJson)) return PATHS.trainedModelDir;
  if (fs.existsSync(bestJson)) return PATHS.bestCheckpointDir;
  return null;
}

export function getActiveModelConfig() {
  const targetFile =
    isSelectedModelAvailable() && fs.existsSync(PATHS.selectedModelConfigFile)
      ? PATHS.selectedModelConfigFile
      : PATHS.modelConfigFile;
  if (!fs.existsSync(targetFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(targetFile, 'utf8'));
  } catch {
    return null;
  }
}

export function getActiveEvaluationMetrics() {
  const targetFile =
    isSelectedModelAvailable() && fs.existsSync(PATHS.selectedMetricsFile)
      ? PATHS.selectedMetricsFile
      : PATHS.metricsFile;
  if (!fs.existsSync(targetFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(targetFile, 'utf8'));
  } catch {
    return null;
  }
}

export async function loadActiveModel(tf, dirPath) {
  const backboneJson = path.join(dirPath, 'backbone/model.json');
  const headDir = path.join(dirPath, 'head');
  if (fs.existsSync(backboneJson) && fs.existsSync(path.join(headDir, 'model.json'))) {
    const configFile = path.join(dirPath, 'modelConfig.json');
    let cfg = null;
    if (fs.existsSync(configFile)) {
      try {
        cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      } catch {
        cfg = null;
      }
    }
    const convNode =
      cfg?.architecture?.convNode || 'module_apply_default/MobilenetV2/Conv_1/Relu6';
    const backbone = await tf.loadGraphModel(`file://${path.resolve(backboneJson)}`);
    const head = await loadModelFromDir(tf, path.resolve(headDir));
    const logitsLayer = head.getLayer('logits');
    const featureDim = head.inputs[0].shape[1];
    const headInput = tf.input({ shape: [featureDim] });
    let h = headInput;
    for (let i = 1; i <= head.layers.indexOf(logitsLayer); i++) {
      h = head.layers[i].apply(h);
    }
    const headLogitModel = tf.model({ inputs: headInput, outputs: h });

    return {
      kind: 'mobilenet_v2_hybrid',
      backbone,
      head,
      headLogitModel,
      convNode,
      config: cfg,
      dispose() {
        try {
          headLogitModel.dispose();
        } catch {
          // ignore
        }
        try {
          head.dispose();
        } catch {
          // ignore
        }
        try {
          backbone.dispose();
        } catch {
          // ignore
        }
      },
    };
  }

  return loadModelFromDir(tf, dirPath);
}

export function summarizeModelArchitecture(model) {
  return {
    name: model.name,
    totalParams: model.countParams(),
    trainableParams: model.trainableWeights.reduce(
      (acc, w) => acc + w.shape.reduce((a, b) => a * b, 1),
      0
    ),
    layerCount: model.layers.length,
    gradcamLayer: 'gradcam_target_relu',
    layers: model.layers.map((l) => ({
      name: l.name,
      className: l.getClassName(),
      trainable: l.trainable,
      outputShape: l.outputShape,
    })),
  };
}
