import sharp from 'sharp';

const ALLOWED_FORMATS = new Set(['jpeg', 'jpg', 'png']);
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MIN_FILE_BYTES = 512;
const MIN_DIMENSION = 64;

export async function assessImageQuality(buffer, originalName = '', mimetype = '') {
  const warnings = [];
  const errors = [];

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < MIN_FILE_BYTES) {
    return {
      valid: false,
      errors: ['Uploaded image buffer is empty or corrupted.'],
      warnings: [],
      metrics: null,
    };
  }

  if (buffer.length > MAX_FILE_BYTES) {
    return {
      valid: false,
      errors: [`File size ${(buffer.length / (1024 * 1024)).toFixed(2)} MB exceeds the 15 MB limit.`],
      warnings: [],
      metrics: null,
    };
  }

  if (mimetype && !['image/jpeg', 'image/jpg', 'image/png'].includes(mimetype.toLowerCase())) {
    return {
      valid: false,
      errors: [`Unsupported MIME type "${mimetype}". Only JPG, JPEG, and PNG are permitted.`],
      warnings: [],
      metrics: null,
    };
  }

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return {
      valid: false,
      errors: ['Image file could not be decoded and appears corrupted or invalid.'],
      warnings: [],
      metrics: null,
    };
  }

  const fmt = (metadata.format || '').toLowerCase();
  if (!ALLOWED_FORMATS.has(fmt)) {
    return {
      valid: false,
      errors: [`Unsupported image format "${fmt || 'unknown'}". Please upload JPG, JPEG, or PNG.`],
      warnings: [],
      metrics: null,
    };
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return {
      valid: false,
      errors: [`Image resolution (${width}x${height}) is below the minimum 64x64 requirement.`],
      warnings: [],
      metrics: null,
    };
  }

  if (width < 192 || height < 192) {
    warnings.push(
      `Low resolution (${width}x${height}). Upscaling to 192x192 may reduce fine dermatologic detail.`
    );
  }

  const aspect = Math.max(width / height, height / width);
  if (aspect > 2.5) {
    warnings.push(
      `Unusual aspect ratio (${width}x${height}). Center-square framing around the lesion is recommended.`
    );
  }

  let rawGray;
  try {
    const { data } = await sharp(buffer)
      .rotate()
      .resize(192, 192, { fit: 'cover' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    rawGray = data;
  } catch {
    return {
      valid: false,
      errors: ['Failed to process image pixel stream. File may be truncated or corrupted.'],
      warnings: [],
      metrics: null,
    };
  }

  const n = rawGray.length;
  let sum = 0;
  let darkClip = 0;
  let brightClip = 0;

  for (let i = 0; i < n; i++) {
    const v = rawGray[i];
    sum += v;
    if (v < 12) darkClip++;
    if (v > 245) brightClip++;
  }

  const meanBrightness = sum / n;
  const darkClipRatio = darkClip / n;
  const brightClipRatio = brightClip / n;

  let lapSum = 0;
  let lapSqSum = 0;
  let lapCount = 0;
  const w = 192;
  const h = 192;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        4 * rawGray[idx] -
        rawGray[idx - 1] -
        rawGray[idx + 1] -
        rawGray[idx - w] -
        rawGray[idx + w];
      lapSum += lap;
      lapSqSum += lap * lap;
      lapCount++;
    }
  }
  const lapMean = lapSum / lapCount;
  const lapVariance = lapSqSum / lapCount - lapMean * lapMean;

  if (meanBrightness < 45) {
    warnings.push('Image is very dark (underexposed). Retake under even, diffused lighting.');
  } else if (meanBrightness > 215) {
    warnings.push('Image is overly bright (overexposed). Avoid direct flash glare on the lesion.');
  }

  if (darkClipRatio > 0.35) {
    warnings.push('Large shadow regions detected (>35% near-black pixels).');
  }
  if (brightClipRatio > 0.25) {
    warnings.push('Significant specular glare or whiteout detected (>25% saturated pixels).');
  }
  if (lapVariance < 35) {
    warnings.push('Image appears blurry or out of focus (low edge sharpness).');
  }

  warnings.push(
    'Technical image checks do not guarantee clinical adequacy; smartphone photographs can miss subsurface features visible on dermoscopy.'
  );

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      originalName,
      format: fmt,
      sizeBytes: buffer.length,
      width,
      height,
      meanBrightness: Number(meanBrightness.toFixed(1)),
      darkClipRatio: Number(darkClipRatio.toFixed(3)),
      brightClipRatio: Number(brightClipRatio.toFixed(3)),
      sharpnessScore: Number(lapVariance.toFixed(1)),
      blurDetected: lapVariance < 35,
      exposureIssue: meanBrightness < 45 || meanBrightness > 215 || brightClipRatio > 0.25,
    },
  };
}
