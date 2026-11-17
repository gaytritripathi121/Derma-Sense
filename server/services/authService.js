import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User, Session, ScreeningHistory } from '../db/models.js';
import { isDatabaseConnected } from '../db/connection.js';

export const AUTH_COOKIE_NAME = 'ds_auth';
const BCRYPT_ROUNDS = 12;
const DUMMY_BCRYPT_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
const SHORT_SESSION_MS = 24 * 60 * 60 * 1000;
const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function sanitizeUser(userDoc) {
  if (!userDoc) return null;
  return {
    id: String(userDoc._id || userDoc.id),
    name: userDoc.name,
    email: userDoc.email,
    createdAt: userDoc.createdAt ? new Date(userDoc.createdAt).toISOString() : null,
    updatedAt: userDoc.updatedAt ? new Date(userDoc.updatedAt).toISOString() : null,
  };
}

export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character.';
  }
  return null;
}

export function hashSessionToken(rawToken) {
  const secret = process.env.SESSION_SECRET || 'dermasense-ephemeral-session-pepper';
  return crypto
    .createHmac('sha256', secret)
    .update(String(rawToken))
    .digest('hex');
}

export function parseAuthCookie(req) {
  const header = req.headers?.cookie || '';
  const regex = new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([a-zA-Z0-9_-]+)`);
  const match = header.match(regex);
  return match ? match[1] : null;
}

export function isSecureRequest(req) {
  if (process.env.NODE_ENV === 'production') return true;
  if (req?.secure) return true;
  const proto = req?.headers?.['x-forwarded-proto'];
  return typeof proto === 'string' && proto.split(',')[0].trim() === 'https';
}

export function setAuthCookie(req, res, rawToken, { rememberMe = false } = {}) {
  const secure = isSecureRequest(req);
  const parts = [
    `${AUTH_COOKIE_NAME}=${rawToken}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  if (rememberMe) {
    parts.push(`Max-Age=${Math.floor(REMEMBER_SESSION_MS / 1000)}`);
  }
  res.append('Set-Cookie', parts.join('; '));
}

export function clearAuthCookie(req, res) {
  const secure = isSecureRequest(req);
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export async function createUserSession(userId, { rememberMe = false } = {}) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const ttlMs = rememberMe ? REMEMBER_SESSION_MS : SHORT_SESSION_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  await Session.create({
    tokenHash,
    userId,
    rememberMe: Boolean(rememberMe),
    expiresAt,
  });

  return { rawToken, expiresAt, rememberMe: Boolean(rememberMe) };
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();

  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    const err = new Error('An account with this email address already exists.');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const created = await User.create({
    name: cleanName,
    email: normalizedEmail,
    passwordHash,
  });

  return sanitizeUser(created);
}

export async function authenticateUser({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const userDoc = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!userDoc) {
    await bcrypt.compare(password || '', DUMMY_BCRYPT_HASH);
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  const matches = await bcrypt.compare(password || '', userDoc.passwordHash);
  if (!matches) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  return sanitizeUser(userDoc);
}

export async function resolveSessionUser(rawToken) {
  if (!rawToken || !isDatabaseConnected()) return null;
  const tokenHash = hashSessionToken(rawToken);
  const sessionDoc = await Session.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!sessionDoc) return null;

  const userDoc = await User.findById(sessionDoc.userId).lean();
  if (!userDoc) return null;

  return {
    user: sanitizeUser(userDoc),
    sessionId: String(sessionDoc._id),
    tokenHash,
  };
}

export async function invalidateSessionByToken(rawToken) {
  if (!rawToken || !isDatabaseConnected()) return;
  const tokenHash = hashSessionToken(rawToken);
  await Session.deleteOne({ tokenHash });
}

export async function updateUserProfile(userId, { name }) {
  const cleanName = String(name || '').trim();
  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { name: cleanName } },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) {
    const err = new Error('Account not found.');
    err.statusCode = 404;
    throw err;
  }
  return sanitizeUser(updated);
}

export async function changeUserPassword(userId, { currentPassword, newPassword, currentTokenHash }) {
  const userDoc = await User.findById(userId).select('+passwordHash');
  if (!userDoc) {
    const err = new Error('Account not found.');
    err.statusCode = 404;
    throw err;
  }

  const valid = await bcrypt.compare(currentPassword || '', userDoc.passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect.');
    err.statusCode = 401;
    throw err;
  }

  userDoc.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userDoc.save();

  // Revoke all other active sessions for this user
  if (currentTokenHash) {
    await Session.deleteMany({ userId: userDoc._id, tokenHash: { $ne: currentTokenHash } });
  } else {
    await Session.deleteMany({ userId: userDoc._id });
  }
}

export async function deleteUserAccount(userId, { password }) {
  const userDoc = await User.findById(userId).select('+passwordHash');
  if (!userDoc) {
    const err = new Error('Account not found.');
    err.statusCode = 404;
    throw err;
  }

  const valid = await bcrypt.compare(password || '', userDoc.passwordHash);
  if (!valid) {
    const err = new Error('Password confirmation is incorrect.');
    err.statusCode = 401;
    throw err;
  }

  await Promise.all([
    ScreeningHistory.deleteMany({ userId: userDoc._id }),
    Session.deleteMany({ userId: userDoc._id }),
  ]);
  await User.deleteOne({ _id: userDoc._id });
}

export function buildPrivacyPreservingHistoryPayload(userId, predictionResult) {
  return {
    userId,
    reportId: predictionResult.reportId,
    predictedCategory: predictionResult.predictedClass,
    fullCategoryName: predictionResult.fullCategoryName,
    confidence: predictionResult.confidence,
    confidencePercentage: predictionResult.confidencePercentage,
    screeningStatus: predictionResult.confidenceAssessment?.status || 'LOW_CONFIDENCE',
    isLowConfidence: Boolean(predictionResult.confidenceAssessment?.isLowConfidence),
    statusLabel: predictionResult.confidenceAssessment?.statusLabel || '',
    confidenceMessage: predictionResult.confidenceAssessment?.message || '',
    topThree: (predictionResult.topThree || []).map((t) => ({
      code: t.code,
      fullName: t.fullName,
      percentage: t.percentage,
    })),
    allProbabilities: (predictionResult.allProbabilities || []).map((p) => ({
      code: p.code,
      fullName: p.fullName,
      probability: p.probability,
      percentage: p.percentage,
    })),
    contextualStatus: predictionResult.contextualAssessment?.contextualStatus || '',
    contextualStatusLabel: predictionResult.contextualAssessment?.contextualStatusLabel || '',
    contextualRecommendation: predictionResult.contextualAssessment?.overallRecommendation || '',
    triggeredFlags: (predictionResult.contextualAssessment?.triggeredFlags || []).map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      title: f.title,
      explanation: f.explanation,
      suggestedNextStep: f.suggestedNextStep,
    })),
    imageQualitySummary: predictionResult.imageQuality?.metrics
      ? {
          width: predictionResult.imageQuality.metrics.width,
          height: predictionResult.imageQuality.metrics.height,
          sharpnessScore: predictionResult.imageQuality.metrics.sharpnessScore,
          meanBrightness: predictionResult.imageQuality.metrics.meanBrightness,
          warnings: predictionResult.imageQuality.warnings || [],
        }
      : undefined,
    modelVersion: predictionResult.modelVersion || '',
    analyzedAt: new Date(predictionResult.analyzedAt || Date.now()),
  };
}

export function formatSavedRecordForFrontend(doc, sessionMatch = null) {
  const status = doc.screeningStatus || (doc.isLowConfidence ? 'LOW_CONFIDENCE' : 'STANDARD_CONFIDENCE');
  return {
    reportId: doc.reportId,
    analyzedAt: doc.analyzedAt ? new Date(doc.analyzedAt).toISOString() : new Date(doc.createdAt).toISOString(),
    modelVersion: doc.modelVersion || '',
    predictedClass: doc.predictedCategory,
    fullCategoryName: doc.fullCategoryName,
    confidence: doc.confidence,
    confidencePercentage: doc.confidencePercentage,
    confidenceAssessment: {
      maxProb: doc.confidence,
      threshold: 0.7,
      isLowConfidence: Boolean(doc.isLowConfidence),
      status,
      statusLabel:
        doc.statusLabel ||
        (doc.isLowConfidence
          ? 'Low Confidence — Uncertain Prediction'
          : 'Standard Confidence (Above Screening Threshold)'),
      message:
        doc.confidenceMessage ||
        (doc.isLowConfidence
          ? 'LOW CONFIDENCE: The model is uncertain about this image. This result should not be relied upon. Please consult a qualified dermatologist.'
          : 'Model confidence exceeds the 70% screening threshold. Note: raw softmax confidence is not a clinically validated diagnostic probability and never rules out malignancy.'),
    },
    topThree: doc.topThree || [],
    allProbabilities: doc.allProbabilities || [],
    imageQuality: doc.imageQualitySummary
      ? {
          valid: true,
          metrics: {
            width: doc.imageQualitySummary.width,
            height: doc.imageQualitySummary.height,
            sharpnessScore: doc.imageQualitySummary.sharpnessScore,
            meanBrightness: doc.imageQualitySummary.meanBrightness,
          },
          warnings: doc.imageQualitySummary.warnings || [],
        }
      : sessionMatch?.imageQuality || null,
    gradcam: sessionMatch?.gradcam || null,
    persistedWithoutImage: !sessionMatch?.gradcam,
    patientHistory: sessionMatch?.patientHistory || {},
    contextualAssessment: {
      contextualStatus: doc.contextualStatus || 'NO_ELEVATED_FLAGS',
      contextualStatusLabel: doc.contextualStatusLabel || 'Evaluated',
      overallRecommendation: doc.contextualRecommendation || '',
      triggeredFlags: doc.triggeredFlags || [],
    },
    disclaimer:
      sessionMatch?.disclaimer ||
      'DermaSense AI is an educational skin-lesion screening and awareness tool. Predictions are preliminary, raw model confidence is not confirmed diagnostic probability, and a benign-looking result never rules out skin cancer. Consult a qualified dermatologist.',
  };
}

export async function saveUserScreening(userId, predictionResult) {
  if (!userId || !isDatabaseConnected()) return null;
  const payload = buildPrivacyPreservingHistoryPayload(userId, predictionResult);
  return ScreeningHistory.create(payload);
}

export async function getUserScreenings(userId, { limit = 50 } = {}) {
  const docs = await ScreeningHistory.find({ userId })
    .sort({ analyzedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    reportId: doc.reportId,
    analyzedAt: doc.analyzedAt ? new Date(doc.analyzedAt).toISOString() : new Date(doc.createdAt).toISOString(),
    predictedClass: doc.predictedCategory,
    fullCategoryName: doc.fullCategoryName,
    confidence: doc.confidence,
    confidencePercentage: doc.confidencePercentage,
    confidenceStatus: doc.screeningStatus,
    confidenceStatusLabel: doc.statusLabel,
    isLowConfidence: Boolean(doc.isLowConfidence),
    topThree: doc.topThree || [],
    thumbnailBase64: null,
    contextualStatus: doc.contextualStatus,
    modelVersion: doc.modelVersion,
    savedToAccount: true,
  }));
}

export async function getUserScreeningByReportId(userId, reportId) {
  return ScreeningHistory.findOne({ userId, reportId }).lean();
}

export async function deleteUserScreeningByReportId(userId, reportId) {
  const result = await ScreeningHistory.deleteOne({ userId, reportId });
  return result.deletedCount > 0;
}

export async function clearUserScreenings(userId) {
  await ScreeningHistory.deleteMany({ userId });
}
