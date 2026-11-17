import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import { attachAuthUser } from '../server/middleware/auth.js';
import authRoutes from '../server/routes/authRoutes.js';
import predictionRoutes from '../server/routes/predictionRoutes.js';
import {
  buildPrivacyPreservingHistoryPayload,
  formatSavedRecordForFrontend,
  hashSessionToken,
  sanitizeUser,
  validatePasswordStrength,
} from '../server/services/authService.js';

test('validatePasswordStrength enforces strong password rules', () => {
  assert.ok(validatePasswordStrength('short'));
  assert.ok(validatePasswordStrength('alllowercase1!'));
  assert.ok(validatePasswordStrength('ALLUPPERCASE1!'));
  assert.ok(validatePasswordStrength('NoNumbersHere!'));
  assert.ok(validatePasswordStrength('NoSymbols1234'));
  assert.equal(validatePasswordStrength('StrongPass1!'), null);
});

test('sanitizeUser strips passwordHash and hashSessionToken never exposes raw token', async () => {
  const hash = await bcrypt.hash('StrongPass1!', 4);
  const sanitized = sanitizeUser({
    _id: '507f1f77bcf86cd799439011',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: hash,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });

  assert.equal(sanitized.id, '507f1f77bcf86cd799439011');
  assert.equal(sanitized.name, 'Test User');
  assert.equal(sanitized.email, 'test@example.com');
  assert.equal('passwordHash' in sanitized, false);

  const rawToken = 'raw-secret-session-token-123';
  const hashed = hashSessionToken(rawToken);
  assert.notEqual(hashed, rawToken);
  assert.equal(hashed.length, 64);
});

test('buildPrivacyPreservingHistoryPayload omits skin photographs and formatSavedRecordForFrontend reconstructs view cleanly', () => {
  const fakePrediction = {
    reportId: 'DS-PRIV-001',
    analyzedAt: '2026-11-17T01:00:00.000Z',
    modelVersion: '2.0.0-mobilenetv2',
    predictedClass: 'BCC',
    fullCategoryName: 'Basal cell carcinoma',
    confidence: 0.76,
    confidencePercentage: 76,
    confidenceAssessment: {
      status: 'STANDARD_CONFIDENCE',
      isLowConfidence: false,
      statusLabel: 'Standard Confidence (Above Screening Threshold)',
      message: 'Above threshold',
    },
    topThree: [{ code: 'BCC', fullName: 'Basal cell carcinoma', percentage: 76 }],
    allProbabilities: [{ code: 'BCC', fullName: 'Basal cell carcinoma', probability: 0.76, percentage: 76 }],
    gradcam: {
      originalBase64: 'data:image/png;base64,SENSITIVE_SKIN_IMAGE',
      heatmapBase64: 'data:image/png;base64,HEATMAP',
      overlayBase64: 'data:image/png;base64,OVERLAY',
    },
    imageQuality: {
      valid: true,
      metrics: { width: 256, height: 256, sharpnessScore: 120, meanBrightness: 130 },
      warnings: [],
    },
    contextualAssessment: {
      contextualStatus: 'MODERATE_CONTEXTUAL_ATTENTION',
      contextualStatusLabel: 'Moderate Contextual Attention',
      overallRecommendation: 'Consult dermatologist.',
      triggeredFlags: [],
    },
    patientHistory: {
      patientInitials: 'J.D.',
      relevantMedicalHistory: 'Private free-text notes',
    },
  };

  const payload = buildPrivacyPreservingHistoryPayload('user-123', fakePrediction);
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('SENSITIVE_SKIN_IMAGE'), false);
  assert.equal(serialized.includes('Private free-text notes'), false);
  assert.equal(serialized.includes('J.D.'), false);
  assert.equal(payload.userId, 'user-123');
  assert.equal(payload.predictedCategory, 'BCC');
  assert.equal(payload.screeningStatus, 'STANDARD_CONFIDENCE');

  const reconstructed = formatSavedRecordForFrontend(payload, null);
  assert.equal(reconstructed.predictedClass, 'BCC');
  assert.equal(reconstructed.persistedWithoutImage, true);
  assert.equal(reconstructed.gradcam, null);
  assert.equal(reconstructed.confidencePercentage, 76);
});

test('Auth routes report honest DB status when MONGODB_URI is absent while preserving Guest Mode', async () => {
  const app = express();
  app.use(express.json());
  app.use(attachAuthUser);
  app.use('/api/auth', authRoutes);
  app.use('/api', predictionRoutes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}/api`;

    const statusRes = await fetch(`${base}/auth/status`);
    assert.equal(statusRes.status, 200);
    const statusJson = await statusRes.json();
    assert.equal(statusJson.authenticated, false);
    assert.equal(statusJson.user, null);
    assert.equal(statusJson.databaseConnected, false);

    const regRes = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Guest User',
        email: 'guest@example.com',
        password: 'StrongPassword1!',
        confirmPassword: 'StrongPassword1!',
      }),
    });
    assert.equal(regRes.status, 503);

    const meRes = await fetch(`${base}/auth/me`);
    assert.equal(meRes.status, 503);

    // Guest history & Safe Corner still work cleanly
    const histRes = await fetch(`${base}/history`);
    assert.equal(histRes.status, 200);
    const histJson = await histRes.json();
    assert.equal(histJson.sessionScoped, true);
    assert.equal(histJson.accountScoped, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Production CORS allows planned Render origin with credentials and rejects unknown origins', async () => {
  const { buildCorsOptions } = await import('../server/config/cors.js');
  const opts = buildCorsOptions(true);
  assert.equal(opts.credentials, true);

  const allowPlanned = await new Promise((resolve) =>
    opts.origin('https://derma-sense.onrender.com', (_err, allowed) => resolve(allowed))
  );
  assert.equal(allowPlanned, true);

  const allowNoOrigin = await new Promise((resolve) =>
    opts.origin(undefined, (_err, allowed) => resolve(allowed))
  );
  assert.equal(allowNoOrigin, true);

  const rejectUnknown = await new Promise((resolve) =>
    opts.origin('https://evil-example.com', (_err, allowed) => resolve(allowed))
  );
  assert.equal(rejectUnknown, false);
});
