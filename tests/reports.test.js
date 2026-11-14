import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { generateScreeningPdfBuffer } from '../server/reports/pdfGenerator.js';
import { generateAppointmentIcs } from '../server/safeCorner/calendarExport.js';

test('generateScreeningPdfBuffer produces valid PDF binary output', async () => {
  const pngBuf = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 140, g: 95, b: 85 },
    },
  })
    .png()
    .toBuffer();
  const dataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;

  const pdfBuffer = generateScreeningPdfBuffer({
    reportId: 'DS-TEST-001',
    analyzedAt: new Date().toISOString(),
    modelVersion: '1.0.0',
    predictedClass: 'BCC',
    fullCategoryName: 'Basal cell carcinoma',
    confidence: 0.78,
    confidencePercentage: 78.0,
    confidenceAssessment: {
      isLowConfidence: false,
      statusLabel: 'Standard Confidence (Above Screening Threshold)',
      message: 'Above threshold',
    },
    topThree: [
      { code: 'BCC', fullName: 'Basal cell carcinoma', percentage: 78.0 },
      { code: 'ACK', fullName: 'Actinic keratosis', percentage: 12.0 },
      { code: 'SCC', fullName: 'Squamous cell carcinoma', percentage: 6.0 },
    ],
    gradcam: {
      originalBase64: dataUrl,
      heatmapBase64: dataUrl,
      overlayBase64: dataUrl,
      explanationNote: 'Test Grad-CAM note.',
    },
    patientHistory: {
      patientInitials: 'J.D.',
      age: 62,
      gender: 'MALE',
      fitzpatrickType: '2',
      region: 'FACE',
      changed: 'YES',
      bleed: 'YES',
    },
    contextualAssessment: {
      contextualStatusLabel: 'High Contextual Attention',
      triggeredFlags: [
        {
          ruleId: 'RULE_BLEEDING',
          severity: 'HIGH_ATTENTION',
          title: 'Spontaneous Bleeding Reported',
          explanation: 'Lesion bleeding reported.',
          suggestedNextStep: 'Consult a dermatologist promptly.',
        },
      ],
    },
  });

  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.ok(pdfBuffer.length > 2000);
  assert.equal(pdfBuffer.subarray(0, 5).toString('utf8'), '%PDF-');
});

test('generateAppointmentIcs outputs RFC 5545 VCALENDAR invite', () => {
  const ics = generateAppointmentIcs({
    title: 'Dermatologist Visit',
    dateTimeIso: '2026-12-01T10:30:00',
    location: 'Skin Clinic',
  });
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:Dermatologist Visit'));
  assert.ok(ics.includes('END:VCALENDAR'));
});
