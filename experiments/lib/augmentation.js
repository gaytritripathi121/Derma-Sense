import sharp from 'sharp';

sharp.cache(false);
sharp.concurrency(1);

export async function loadRgbUint8(filePath, imageSize) {
  const { data } = await sharp(filePath)
    .rotate()
    .removeAlpha()
    .toColorspace('srgb')
    .resize(imageSize, imageSize, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * Clinically realistic dermatological augmentation:
 * - Preserves lesion chromaticity (no hue shifts or color inversions)
 * - Uses 90/180/270-degree orientation invariance, H/V flips, gentle center crop/zoom,
 *   and mild lighting exposure/contrast shifts consistent with smartphone photography.
 */
export function augmentUint8ToFloat(srcUint8, size, { mode = 'zero_to_one', rng = Math.random } = {}) {
  const len = size * size * 3;
  const dst = new Float32Array(len);
  const rot = Math.floor(rng() * 4); // 0, 90, 180, 270 deg
  const flipH = rng() < 0.5;
  const flipV = rng() < 0.3;
  const zoom = 0.84 + rng() * 0.16;
  const maxShift = Math.floor(size * (1 - zoom));
  const shiftX = Math.floor(rng() * (maxShift + 1));
  const shiftY = Math.floor(rng() * (maxShift + 1));
  const brightnessDelta = (rng() - 0.5) * 0.14;
  const contrastFactor = 0.88 + rng() * 0.24;

  for (let y = 0; y < size; y++) {
    const zy = Math.min(size - 1, Math.floor(y * zoom) + shiftY);
    for (let x = 0; x < size; x++) {
      const zx = Math.min(size - 1, Math.floor(x * zoom) + shiftX);

      let rx = zx;
      let ry = zy;
      if (rot === 1) {
        rx = size - 1 - zy;
        ry = zx;
      } else if (rot === 2) {
        rx = size - 1 - zx;
        ry = size - 1 - zy;
      } else if (rot === 3) {
        rx = zy;
        ry = size - 1 - zx;
      }

      if (flipH) rx = size - 1 - rx;
      if (flipV) ry = size - 1 - ry;

      const sIdx = (ry * size + rx) * 3;
      const dIdx = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) {
        let v = srcUint8[sIdx + c] / 255.0;
        v = (v - 0.5) * contrastFactor + 0.5 + brightnessDelta;
        if (v < 0) v = 0;
        if (v > 1) v = 1;
        dst[dIdx + c] = mode === 'minus_one_to_one' ? v * 2.0 - 1.0 : v;
      }
    }
  }
  return dst;
}

export function uint8ToFloat(srcUint8, mode = 'zero_to_one') {
  const dst = new Float32Array(srcUint8.length);
  if (mode === 'minus_one_to_one') {
    for (let i = 0; i < srcUint8.length; i++) {
      dst[i] = srcUint8[i] / 127.5 - 1.0;
    }
  } else {
    for (let i = 0; i < srcUint8.length; i++) {
      dst[i] = srcUint8[i] / 255.0;
    }
  }
  return dst;
}

export function createSeededRng(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleArray(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createWeightedSmoothedLoss(tf, classWeightsArray, labelSmoothing = 0.05) {
  const weightsTensor = tf.tensor1d(classWeightsArray, 'float32');
  const numClasses = classWeightsArray.length;
  return (yTrue, yPred) =>
    tf.tidy(() => {
      const eps = 1e-7;
      const smoothTrue = yTrue
        .mul(1 - labelSmoothing)
        .add(labelSmoothing / numClasses);
      const clipped = tf.clipByValue(yPred, eps, 1 - eps);
      const logPreds = tf.log(clipped);
      const perClassLoss = tf.mul(smoothTrue, logPreds).neg();
      const weighted = tf.mul(perClassLoss, weightsTensor);
      return tf.mean(tf.sum(weighted, -1));
    });
}
