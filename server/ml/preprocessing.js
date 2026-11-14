import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PATHS } from '../config/constants.js';

sharp.cache(false);
sharp.concurrency(1);

export const PREPROCESSING_CONFIG = {
  imageSize: 192,
  channels: 3,
  normalization: 'zero_to_one',
  colorSpace: 'RGB',
};

export async function preprocessImageToFloat32(input, imageSize = PREPROCESSING_CONFIG.imageSize) {
  const { data } = await sharp(input)
    .rotate()
    .removeAlpha()
    .toColorspace('srgb')
    .resize(imageSize, imageSize, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const floatData = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    floatData[i] = data[i] / 255.0;
  }
  return floatData;
}

export async function ensurePreprocessedCache(records, imageSize = 192, onProgress = null) {
  fs.mkdirSync(PATHS.processedCache, { recursive: true });
  const total = records.length;
  let completed = 0;
  const BATCH = 16;

  for (let i = 0; i < total; i += BATCH) {
    const slice = records.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (rec) => {
        const cachePath = path.join(PATHS.processedCache, `${rec.imgId}.rgb`);
        if (!fs.existsSync(cachePath)) {
          const { data } = await sharp(rec.filePath)
            .rotate()
            .removeAlpha()
            .toColorspace('srgb')
            .resize(imageSize, imageSize, { fit: 'cover' })
            .raw()
            .toBuffer({ resolveWithObject: true });
          await fs.promises.writeFile(cachePath, data);
        }
        rec.cachePath = cachePath;
      })
    );
    completed += slice.length;
    if (onProgress) onProgress(completed, total);
  }
}

export function augmentRgbFloat32(src, size, rng = Math.random) {
  const dst = new Float32Array(src.length);
  const flipH = rng() < 0.5;
  const flipV = rng() < 0.25;
  const brightnessDelta = (rng() - 0.5) * 0.14;
  const contrastFactor = 0.9 + rng() * 0.2;
  const zoom = 0.9 + rng() * 0.1;
  const maxShift = Math.floor(size * (1 - zoom));
  const shiftX = Math.floor(rng() * (maxShift + 1));
  const shiftY = Math.floor(rng() * (maxShift + 1));

  for (let y = 0; y < size; y++) {
    const syBase = Math.min(size - 1, Math.floor(y * zoom) + shiftY);
    const sy = flipV ? size - 1 - syBase : syBase;
    for (let x = 0; x < size; x++) {
      const sxBase = Math.min(size - 1, Math.floor(x * zoom) + shiftX);
      const sx = flipH ? size - 1 - sxBase : sxBase;
      const sIdx = (sy * size + sx) * 3;
      const dIdx = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) {
        let v = (src[sIdx + c] - 0.5) * contrastFactor + 0.5 + brightnessDelta;
        if (v < 0) v = 0;
        if (v > 1) v = 1;
        dst[dIdx + c] = v;
      }
    }
  }
  return dst;
}

export async function loadBatchTensors(tf, records, imageSize, { augment = false } = {}) {
  const batchSize = records.length;
  const pixelsPerImage = imageSize * imageSize * 3;
  const xData = new Float32Array(batchSize * pixelsPerImage);
  const yIndices = new Int32Array(batchSize);
  const scratch = augment ? new Float32Array(pixelsPerImage) : null;

  for (let i = 0; i < batchSize; i++) {
    const rec = records[i];
    const raw =
      rec.cachePath && fs.existsSync(rec.cachePath)
        ? await fs.promises.readFile(rec.cachePath)
        : await sharp(rec.filePath)
            .rotate()
            .removeAlpha()
            .toColorspace('srgb')
            .resize(imageSize, imageSize, { fit: 'cover' })
            .raw()
            .toBuffer();

    const offset = i * pixelsPerImage;
    if (augment) {
      for (let j = 0; j < pixelsPerImage; j++) {
        scratch[j] = raw[j] / 255.0;
      }
      const processed = augmentRgbFloat32(scratch, imageSize);
      xData.set(processed, offset);
    } else {
      for (let j = 0; j < pixelsPerImage; j++) {
        xData[offset + j] = raw[j] / 255.0;
      }
    }
    yIndices[i] = rec.labelIndex;
  }

  return tf.tidy(() => {
    const xs = tf.tensor4d(xData, [batchSize, imageSize, imageSize, 3]);
    const labelTensor = tf.tensor1d(yIndices, 'int32');
    const ys = tf.oneHot(labelTensor, 6).toFloat();
    return { xs, ys };
  });
}
