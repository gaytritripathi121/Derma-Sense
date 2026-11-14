export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

export const LOW_CONFIDENCE_MESSAGE =
  'LOW CONFIDENCE: The model is uncertain about this image. This result should not be relied upon. Please consult a qualified dermatologist.';

export function evaluateConfidence(probabilities, threshold = DEFAULT_CONFIDENCE_THRESHOLD) {
  const maxProb = Math.max(...probabilities);
  const maxIndex = probabilities.indexOf(maxProb);

  let entropy = 0;
  for (const p of probabilities) {
    if (p > 1e-8) {
      entropy -= p * Math.log(p);
    }
  }
  const normalizedEntropy = entropy / Math.log(probabilities.length);
  const isLowConfidence = maxProb < threshold || normalizedEntropy > 0.85;

  return {
    maxProb,
    maxIndex,
    threshold,
    normalizedEntropy: Number(normalizedEntropy.toFixed(4)),
    isLowConfidence,
    status: isLowConfidence ? 'LOW_CONFIDENCE' : 'STANDARD_CONFIDENCE',
    statusLabel: isLowConfidence
      ? 'Low Confidence — Uncertain Prediction'
      : 'Standard Confidence (Above Screening Threshold)',
    message: isLowConfidence
      ? LOW_CONFIDENCE_MESSAGE
      : 'Model confidence exceeds the 70% screening threshold. Note: raw softmax confidence is not a clinically validated diagnostic probability and never rules out malignancy.',
  };
}
