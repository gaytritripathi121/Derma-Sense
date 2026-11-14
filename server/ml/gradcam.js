import sharp from 'sharp';

function jetColormap(val) {
  const v = Math.max(0, Math.min(1, val));
  const r = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 3))));
  const g = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 2))));
  const b = Math.round(255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * v - 1))));
  return [r, g, b];
}

export async function generateGradCAM(tf, model, inputTensor, originalImageBuffer, targetClassIdx) {
  let layerName = 'gradcam_target_relu';
  let cam2dData;

  if (model?.kind === 'mobilenet_v2_hybrid') {
    layerName = model.convNode || 'module_apply_default/MobilenetV2/Conv_1/Relu6';
    cam2dData = tf.tidy(() => {
      const convActivations = model.backbone.execute(inputTensor, layerName);
      const gradFn = tf.grad((convTensor) => {
        const pooled = convTensor.mean([1, 2]);
        const logits = model.headLogitModel.apply(pooled, { training: false });
        return logits.gather([targetClassIdx], 1).squeeze();
      });
      const grads = gradFn(convActivations);
      const weights = grads.mean([1, 2]);
      const weightedFeatures = convActivations.mul(weights.reshape([1, 1, 1, -1]));
      const rawCam = weightedFeatures.sum(-1).squeeze();
      const reluCam = tf.relu(rawCam);
      const maxVal = reluCam.max().add(1e-8);
      return reluCam.div(maxVal);
    });
  } else {
    const targetLayer = model.getLayer('gradcam_target_relu');
    const logitsLayer = model.getLayer('logits');

    const featureModel = tf.model({
      inputs: model.inputs,
      outputs: targetLayer.output,
    });

    const tailInputShape = targetLayer.outputShape.slice(1);
    const headInput = tf.input({ shape: tailInputShape });
    let h = headInput;
    const targetIdxInLayers = model.layers.indexOf(targetLayer);
    const logitsIdxInLayers = model.layers.indexOf(logitsLayer);

    for (let i = targetIdxInLayers + 1; i <= logitsIdxInLayers; i++) {
      h = model.layers[i].apply(h);
    }
    const headModel = tf.model({ inputs: headInput, outputs: h });

    cam2dData = tf.tidy(() => {
      const convActivations = featureModel.predict(inputTensor);
      const gradFn = tf.grad((convTensor) => {
        const logits = headModel.apply(convTensor, { training: false });
        return logits.gather([targetClassIdx], 1).squeeze();
      });
      const grads = gradFn(convActivations);
      const weights = grads.mean([1, 2]);
      const weightedFeatures = convActivations.mul(weights.reshape([1, 1, 1, -1]));
      const rawCam = weightedFeatures.sum(-1).squeeze();
      const reluCam = tf.relu(rawCam);
      const maxVal = reluCam.max().add(1e-8);
      return reluCam.div(maxVal);
    });

    featureModel.dispose();
    headModel.dispose();
  }

  const [camH, camW] = cam2dData.shape;
  const camValues = await cam2dData.data();
  cam2dData.dispose();

  const origMeta = await sharp(originalImageBuffer).rotate().metadata();
  const outW = Math.min(640, origMeta.width || 320);
  const outH = Math.min(640, origMeta.height || 320);

  const smallHeatmapRgb = Buffer.alloc(camW * camH * 3);
  const smallOverlayRgba = Buffer.alloc(camW * camH * 4);

  for (let i = 0; i < camW * camH; i++) {
    const v = camValues[i];
    const [r, g, b] = jetColormap(v);
    smallHeatmapRgb[i * 3] = r;
    smallHeatmapRgb[i * 3 + 1] = g;
    smallHeatmapRgb[i * 3 + 2] = b;

    smallOverlayRgba[i * 4] = r;
    smallOverlayRgba[i * 4 + 1] = g;
    smallOverlayRgba[i * 4 + 2] = b;
    smallOverlayRgba[i * 4 + 3] = Math.round(Math.max(25, Math.min(190, v * 200)));
  }

  const heatmapPng = await sharp(smallHeatmapRgb, {
    raw: { width: camW, height: camH, channels: 3 },
  })
    .resize(outW, outH, { kernel: sharp.kernel.cubic })
    .png()
    .toBuffer();

  const overlayLayerPng = await sharp(smallOverlayRgba, {
    raw: { width: camW, height: camH, channels: 4 },
  })
    .resize(outW, outH, { kernel: sharp.kernel.cubic })
    .png()
    .toBuffer();

  const baseOriginalPng = await sharp(originalImageBuffer)
    .rotate()
    .resize(outW, outH, { fit: 'cover' })
    .png()
    .toBuffer();

  const combinedOverlayPng = await sharp(baseOriginalPng)
    .composite([{ input: overlayLayerPng, blend: 'over' }])
    .png()
    .toBuffer();

  let peakVal = 0;
  let peakY = 0;
  let peakX = 0;
  let activeCells = 0;
  for (let y = 0; y < camH; y++) {
    for (let x = 0; x < camW; x++) {
      const val = camValues[y * camW + x];
      if (val > 0.5) activeCells++;
      if (val > peakVal) {
        peakVal = val;
        peakY = y;
        peakX = x;
      }
    }
  }

  return {
    layerName,
    featureMapShape: [camH, camW],
    activeFocusRatio: Number((activeCells / (camH * camW)).toFixed(3)),
    peakCoordinateNormalized: {
      x: Number(((peakX + 0.5) / camW).toFixed(2)),
      y: Number(((peakY + 0.5) / camH).toFixed(2)),
    },
    originalBase64: `data:image/png;base64,${baseOriginalPng.toString('base64')}`,
    heatmapBase64: `data:image/png;base64,${heatmapPng.toString('base64')}`,
    overlayBase64: `data:image/png;base64,${combinedOverlayPng.toString('base64')}`,
    explanationNote:
      "Highlighted regions indicate image areas that contributed to the model's prediction. This visualization does not establish medical significance or provide clinical proof.",
  };
}
