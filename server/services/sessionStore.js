import crypto from 'crypto';

const sessionBuckets = new Map();
const MAX_HISTORY_PER_SESSION = 25;
const MAX_SESSIONS = 100;

export function getOrCreateSessionId(req, res) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)ds_session=([a-zA-Z0-9_-]+)/);
  let sid = match ? match[1] : null;
  if (!sid) {
    sid = crypto.randomBytes(16).toString('hex');
    res.setHeader(
      'Set-Cookie',
      `ds_session=${sid}; Path=/; HttpOnly; SameSite=Lax`
    );
  }
  if (!sessionBuckets.has(sid)) {
    if (sessionBuckets.size >= MAX_SESSIONS) {
      const oldestKey = sessionBuckets.keys().next().value;
      sessionBuckets.delete(oldestKey);
    }
    sessionBuckets.set(sid, []);
  }
  return sid;
}

export function addPredictionToSession(sid, predictionResult) {
  const list = sessionBuckets.get(sid) || [];
  list.unshift(predictionResult);
  if (list.length > MAX_HISTORY_PER_SESSION) {
    list.length = MAX_HISTORY_PER_SESSION;
  }
  sessionBuckets.set(sid, list);
}

export function getSessionHistory(sid) {
  const list = sessionBuckets.get(sid) || [];
  return list.map((item) => ({
    reportId: item.reportId,
    analyzedAt: item.analyzedAt,
    predictedClass: item.predictedClass,
    fullCategoryName: item.fullCategoryName,
    confidence: item.confidence,
    confidencePercentage: item.confidencePercentage,
    confidenceStatus: item.confidenceAssessment?.status,
    confidenceStatusLabel: item.confidenceAssessment?.statusLabel,
    isLowConfidence: item.confidenceAssessment?.isLowConfidence,
    topThree: item.topThree,
    thumbnailBase64: item.gradcam?.originalBase64 || null,
    contextualStatus: item.contextualAssessment?.contextualStatus,
    modelVersion: item.modelVersion,
  }));
}

export function getSessionRecordById(sid, reportId) {
  const list = sessionBuckets.get(sid) || [];
  return list.find((item) => item.reportId === reportId) || null;
}

export function clearSessionHistory(sid) {
  sessionBuckets.set(sid, []);
}
