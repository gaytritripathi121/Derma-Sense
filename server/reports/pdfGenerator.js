import { jsPDF } from 'jspdf';
import { MENDELEY_DATASET_INFO } from '../config/constants.js';
import { DISEASE_INFO } from '../../src/data/diseaseInfo.js';
import { generateSafeCornerPlan } from '../safeCorner/planner.js';

function cleanBase64Payload(dataUrl = '') {
  if (!dataUrl) return null;
  const idx = dataUrl.indexOf('base64,');
  return idx >= 0 ? dataUrl.slice(idx + 7) : dataUrl;
}

export function generateScreeningPdfBuffer(record) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  let y = 48;

  const ensureSpace = (needed = 40) => {
    if (y + needed > pageH - 48) {
      doc.addPage();
      y = 48;
    }
  };

  const addSectionTitle = (title) => {
    ensureSpace(36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };

  const addBodyLine = (text, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 9.5);
    const color = opts.color || [51, 65, 85];
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(String(text || ''), opts.maxWidth || contentW);
    for (const line of lines) {
      ensureSpace(14);
      doc.text(line, opts.x || margin, y);
      y += opts.lineHeight || 13;
    }
  };

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 74, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('DermaSense AI — Skin Lesion Screening Report', margin, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Report ID: ${record.reportId}   |   Generated: ${new Date(record.analyzedAt).toLocaleString('en-US')}   |   Model v${record.modelVersion}`,
    margin,
    52
  );
  if (record.patientHistory?.patientInitials) {
    doc.text(`Patient Initials: ${record.patientHistory.patientInitials}`, pageW - margin - 130, 52);
  }
  y = 94;

  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, y, contentW, 44, 4, 4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  const discLines = doc.splitTextToSize(
    'MEDICAL DISCLAIMER: DermaSense AI is an experimental AI-based skin screening tool. It does not provide a medical diagnosis and cannot replace professional medical evaluation. Always consult a qualified dermatologist.',
    contentW - 16
  );
  doc.text(discLines, margin + 8, y + 15);
  y += 58;

  addSectionTitle('1. CNN Image Screening Result');
  addBodyLine(
    `Predicted Category: ${record.predictedClass} — ${record.fullCategoryName}`,
    { bold: true, size: 11, color: [15, 23, 42] }
  );
  addBodyLine(
    `Model Confidence: ${record.confidencePercentage}%   |   Status: ${record.confidenceAssessment?.statusLabel || 'Evaluated'}`
  );
  if (record.confidenceAssessment?.isLowConfidence) {
    addBodyLine(record.confidenceAssessment.message, {
      bold: true,
      color: [185, 28, 28],
    });
  }
  y += 4;
  addBodyLine('Top Three Predictions:', { bold: true });
  for (const item of record.topThree || []) {
    addBodyLine(`  • ${item.code} (${item.fullName}): ${item.percentage}%`, { size: 9 });
  }
  y += 8;

  addSectionTitle('2. Uploaded Lesion Image & Grad-CAM Explainability');
  const origB64 = cleanBase64Payload(record.gradcam?.originalBase64);
  const heatB64 = cleanBase64Payload(record.gradcam?.heatmapBase64);
  const overB64 = cleanBase64Payload(record.gradcam?.overlayBase64);

  if (origB64 || heatB64 || overB64) {
    ensureSpace(150);
    const imgSize = 148;
    const gap = (contentW - imgSize * 3) / 2;

    if (origB64) doc.addImage(origB64, 'PNG', margin, y, imgSize, imgSize);
    if (heatB64) doc.addImage(heatB64, 'PNG', margin + imgSize + gap, y, imgSize, imgSize);
    if (overB64) doc.addImage(overB64, 'PNG', margin + (imgSize + gap) * 2, y, imgSize, imgSize);

    y += imgSize + 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Original Input', margin + 40, y);
    doc.text('Grad-CAM Heatmap', margin + imgSize + gap + 30, y);
    doc.text('Combined Overlay', margin + (imgSize + gap) * 2 + 32, y);
    y += 14;
    addBodyLine(
      record.gradcam?.explanationNote ||
        'Highlighted regions indicate image areas that contributed to the model prediction. This visualization does not establish medical significance or provide clinical proof.',
      { size: 8.5 }
    );
  } else {
    addBodyLine(
      'Uploaded skin photographs and Grad-CAM image overlays are not stored permanently in account history to protect your privacy.',
      { size: 8.5 }
    );
  }
  y += 8;

  addSectionTitle('3. Patient-History Summary & Independent Contextual Flags');
  const ph = record.patientHistory || {};
  addBodyLine(
    `Age: ${ph.age || 'Undisclosed'}  |  Gender: ${ph.gender || 'UNKNOWN'}  |  Fitzpatrick Type: ${ph.fitzpatrickType || 'UNKNOWN'}  |  Region: ${ph.region || 'UNKNOWN'}  |  Diameter: ${ph.diameterMm ? `${ph.diameterMm} mm` : 'Undisclosed'}`
  );
  addBodyLine(
    `Personal Skin Cancer History: ${ph.personalSkinCancerHistory || 'UNKNOWN'}  |  Family History: ${ph.familySkinCancerHistory || 'UNKNOWN'}  |  Duration: ${ph.lesionDuration || 'UNKNOWN'}`
  );
  addBodyLine(
    `Symptoms — Changing: ${ph.changed || 'UNKNOWN'} | Bleeding: ${ph.bleed || 'UNKNOWN'} | Growing: ${ph.grew || 'UNKNOWN'} | Pain: ${ph.hurt || 'UNKNOWN'} | Itch: ${ph.itch || 'UNKNOWN'} | Elevated: ${ph.elevation || 'UNKNOWN'}`
  );
  y += 4;
  const ctx = record.contextualAssessment;
  addBodyLine(`Contextual Status: ${ctx?.contextualStatusLabel || 'Evaluated'}`, { bold: true });
  if (ctx?.triggeredFlags?.length) {
    for (const flag of ctx.triggeredFlags) {
      addBodyLine(
        `  • [${flag.severity}] ${flag.title} (${flag.ruleId}): ${flag.explanation} Next step: ${flag.suggestedNextStep}`,
        { size: 8.5 }
      );
    }
  } else {
    addBodyLine('  • No patient-history attention flags triggered.');
  }
  y += 8;

  addSectionTitle('4. Disease Reference & Safe Corner Wellness Plan');
  const info = DISEASE_INFO[record.predictedClass];
  if (info && !record.confidenceAssessment?.isLowConfidence) {
    addBodyLine(`${info.fullName} (${info.code}) — ${info.group}`, { bold: true });
    addBodyLine(info.summary, { size: 9 });
    addBodyLine(`Urgency Guidance: ${info.urgencyGuidance}`, { bold: true, size: 9 });
    addBodyLine('Suggested Next Steps:', { bold: true, size: 9 });
    for (const step of info.suggestedNextSteps) {
      addBodyLine(`  • ${step}`, { size: 8.5 });
    }
  } else {
    addBodyLine(
      'Because confidence is below 70%, condition-specific guidance is withheld. Consult a qualified dermatologist for clinical assessment.',
      { bold: true, size: 9 }
    );
  }

  y += 4;
  const plan = generateSafeCornerPlan({
    predictedClass: record.predictedClass,
    isLowConfidence: Boolean(record.confidenceAssessment?.isLowConfidence),
    patientHistory: ph,
  });
  addBodyLine(`Safe Corner Routine (${plan.conditionGuidance.headline}):`, { bold: true, size: 9 });
  for (const item of plan.schedule.slice(0, 5)) {
    addBodyLine(`  • ${item.time} (${item.category}): ${item.title}`, { size: 8.5 });
  }
  y += 8;

  addSectionTitle('5. Screening System Provenance & Educational Notice');
  addBodyLine(
    `Dataset Source: PAD-UFES-20 (${MENDELEY_DATASET_INFO.sourcePage})   |   Model Version: ${record.modelVersion}`
  );
  addBodyLine(
    'Note: Individual prediction confidence reflects softmax score concentration on this single photograph for uncertainty gating and does not represent overall diagnostic accuracy. This summary supports educational awareness and professional dermatology consultation.',
    { size: 8.5 }
  );

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
