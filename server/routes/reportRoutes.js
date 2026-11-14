import express from 'express';
import { generateScreeningPdfBuffer } from '../reports/pdfGenerator.js';
import { getOrCreateSessionId, getSessionRecordById } from '../services/sessionStore.js';

const router = express.Router();

router.post('/generate', (req, res, next) => {
  try {
    const sid = getOrCreateSessionId(req, res);
    let record = req.body?.record || null;

    if (!record && req.body?.reportId) {
      record = getSessionRecordById(sid, req.body.reportId);
    }

    if (!record || !record.predictedClass) {
      return res.status(400).json({
        error: 'A valid screening record or active session reportId is required to generate a PDF report.',
      });
    }

    const pdfBuffer = generateScreeningPdfBuffer(record);
    const safeId = String(record.reportId || 'screening').replace(/[^a-zA-Z0-9_-]/g, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="DermaSense-Report-${safeId}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (err) {
    return next(err);
  }
});

export default router;
