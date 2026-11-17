import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { patientHistorySchema } from '../../src/utils/validation.js';
import { runPrediction } from '../ml/predict.js';
import { isDatabaseConnected } from '../db/connection.js';
import {
  clearUserScreenings,
  deleteUserScreeningByReportId,
  formatSavedRecordForFrontend,
  getUserScreeningByReportId,
  getUserScreenings,
  saveUserScreening,
} from '../services/authService.js';
import {
  addPredictionToSession,
  clearSessionHistory,
  getOrCreateSessionId,
  getSessionHistory,
  getSessionRecordById,
} from '../services/sessionStore.js';
import { generateSafeCornerPlan } from '../safeCorner/planner.js';
import { generateAppointmentIcs } from '../safeCorner/calendarExport.js';

const router = express.Router();

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function parsePatientHistoryInput(raw) {
  let obj = {};
  if (typeof raw === 'string' && raw.trim()) {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === 'object') {
    obj = raw;
  }

  if (obj.age === '' || obj.age === null || obj.age === undefined) {
    obj.age = null;
  } else if (!Number.isNaN(Number(obj.age))) {
    obj.age = Number(obj.age);
  }

  if (obj.diameterMm === '' || obj.diameterMm === null || obj.diameterMm === undefined) {
    obj.diameterMm = null;
  } else if (!Number.isNaN(Number(obj.diameterMm))) {
    obj.diameterMm = Number(obj.diameterMm);
  }

  const parsed = patientHistorySchema.safeParse(obj);
  if (!parsed.success) {
    const err = new Error('Invalid patient history fields.');
    err.statusCode = 400;
    err.details = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}

router.post('/predict', memoryUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: 'Please upload a valid lesion image file (JPG, JPEG, or PNG).',
      });
    }

    const sid = getOrCreateSessionId(req, res);
    const patientHistory = parsePatientHistoryInput(req.body?.patientHistory);

    const result = await runPrediction({
      imageBuffer: req.file.buffer,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      patientHistory,
    });

    addPredictionToSession(sid, result);

    let savedToAccount = false;
    if (req.user && isDatabaseConnected()) {
      try {
        await saveUserScreening(req.user.id, result);
        savedToAccount = true;
      } catch (saveErr) {
        console.error('Failed to save screening to authenticated user account:', saveErr.message);
      }
    }

    return res.json({
      ...result,
      savedToAccount,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const sid = getOrCreateSessionId(req, res);

    if (req.user && isDatabaseConnected()) {
      const accountItems = await getUserScreenings(req.user.id);
      const enriched = accountItems.map((item) => {
        const sessionMatch = getSessionRecordById(sid, item.reportId);
        return {
          ...item,
          thumbnailBase64: sessionMatch?.gradcam?.originalBase64 || null,
        };
      });
      return res.json({
        sessionScoped: false,
        accountScoped: true,
        retentionPolicy:
          'Saved to your DermaSense AI account without storing uploaded skin photographs.',
        items: enriched,
      });
    }

    return res.json({
      sessionScoped: true,
      accountScoped: false,
      retentionPolicy:
        'Ephemeral session memory only; cleared when browser session resets or cleared manually.',
      items: getSessionHistory(sid),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/history/:reportId', async (req, res, next) => {
  try {
    const sid = getOrCreateSessionId(req, res);

    if (req.user && isDatabaseConnected()) {
      const savedDoc = await getUserScreeningByReportId(req.user.id, req.params.reportId);
      if (!savedDoc) {
        return res.status(404).json({ error: 'Screening record not found for your account.' });
      }
      const sessionMatch = getSessionRecordById(sid, req.params.reportId);
      return res.json(formatSavedRecordForFrontend(savedDoc, sessionMatch));
    }

    const record = getSessionRecordById(sid, req.params.reportId);
    if (!record) {
      return res.status(404).json({ error: 'Screening record not found in current session.' });
    }
    return res.json(record);
  } catch (err) {
    return next(err);
  }
});

router.delete('/history/:reportId', async (req, res, next) => {
  try {
    if (req.user && isDatabaseConnected()) {
      const deleted = await deleteUserScreeningByReportId(req.user.id, req.params.reportId);
      if (!deleted) {
        return res.status(404).json({ error: 'Screening record not found for your account.' });
      }
      return res.json({ deleted: true });
    }
    return res.status(401).json({ error: 'Authentication required to delete a saved record.' });
  } catch (err) {
    return next(err);
  }
});

router.delete('/history', async (req, res, next) => {
  try {
    const sid = getOrCreateSessionId(req, res);
    clearSessionHistory(sid);
    if (req.user && isDatabaseConnected()) {
      await clearUserScreenings(req.user.id);
    }
    return res.json({ cleared: true });
  } catch (err) {
    return next(err);
  }
});

const safeCornerPlanSchema = z.object({
  predictedClass: z.string().nullable().optional(),
  isLowConfidence: z.boolean().default(true),
  patientHistory: z.record(z.string(), z.any()).optional().default({}),
  wakeTime: z.string().default('07:00'),
  sleepTime: z.string().default('22:30'),
  preferences: z.record(z.string(), z.any()).optional().default({}),
});

router.post('/safe-corner/plan', (req, res, next) => {
  try {
    const parsed = safeCornerPlanSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid Safe Corner planner parameters.' });
    }
    const plan = generateSafeCornerPlan(parsed.data);
    return res.json(plan);
  } catch (err) {
    return next(err);
  }
});

const calendarSchema = z.object({
  title: z.string().min(1).max(120).default('Dermatology Skin Screening Follow-Up'),
  dateTimeIso: z.string().min(4),
  durationMinutes: z.coerce.number().int().min(10).max(240).default(45),
  location: z.string().max(160).default('Dermatology Clinic'),
  notes: z.string().max(500).default('Bring DermaSense AI screening PDF summary and ABCDE observation log.'),
});

router.post('/safe-corner/calendar', (req, res, next) => {
  try {
    const parsed = calendarSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid appointment details for calendar export.' });
    }
    const ics = generateAppointmentIcs(parsed.data);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dermasense-followup.ics"');
    return res.send(ics);
  } catch (err) {
    err.statusCode = 400;
    return next(err);
  }
});

export default router;
