import express from 'express';
import { z } from 'zod';
import { getDatabaseStatus } from '../db/connection.js';
import {
  authRateLimiter,
  requireAuth,
  requireDatabase,
  sensitiveAccountLimiter,
} from '../middleware/auth.js';
import {
  authenticateUser,
  changeUserPassword,
  clearAuthCookie,
  createUserSession,
  deleteUserAccount,
  getUserScreenings,
  invalidateSessionByToken,
  parseAuthCookie,
  registerUser,
  setAuthCookie,
  updateUserProfile,
  validatePasswordStrength,
} from '../services/authService.js';

const router = express.Router();

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(80),
    email: z.string().trim().email('Please enter a valid email address.').max(160),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    rememberMe: z.boolean().optional().default(false),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').max(160),
  password: z.string().min(1, 'Password is required.').max(128),
  rememberMe: z.boolean().optional().default(false),
});

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(80),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.').max(128),
    newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match.',
    path: ['confirmNewPassword'],
  });

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required to delete your account.').max(128),
  confirmText: z.literal('DELETE', {
    errorMap: () => ({ message: 'Please type DELETE to confirm permanent account deletion.' }),
  }),
});

router.get('/status', (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.json({
    databaseConfigured: dbStatus.databaseConfigured,
    databaseConnected: dbStatus.databaseConnected,
    authenticated: Boolean(req.user),
    user: req.user || null,
  });
});

router.post('/register', authRateLimiter, requireDatabase, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return res.status(400).json({ error: firstError || 'Invalid registration input.' });
    }

    const strengthError = validatePasswordStrength(parsed.data.password);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    const user = await registerUser({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });

    const session = await createUserSession(user.id, {
      rememberMe: parsed.data.rememberMe,
    });
    setAuthCookie(req, res, session.rawToken, { rememberMe: session.rememberMe });

    return res.status(201).json({ user });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', authRateLimiter, requireDatabase, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return res.status(400).json({ error: firstError || 'Please provide a valid email and password.' });
    }

    const user = await authenticateUser({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    const session = await createUserSession(user.id, {
      rememberMe: parsed.data.rememberMe,
    });
    setAuthCookie(req, res, session.rawToken, { rememberMe: session.rememberMe });

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', async (req, res) => {
  try {
    const rawToken = parseAuthCookie(req);
    await invalidateSessionByToken(rawToken);
  } catch {
    // ignore cleanup errors and clear cookie regardless
  }
  clearAuthCookie(req, res);
  return res.json({ loggedOut: true });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const items = await getUserScreenings(req.user.id, { limit: 100 });
    return res.json({
      user: req.user,
      stats: {
        totalSavedScreenings: items.length,
        latestScreeningAt: items[0]?.analyzedAt || null,
        latestPredictedCategory: items[0]?.predictedClass || null,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/profile', sensitiveAccountLimiter, requireAuth, async (req, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return res.status(400).json({ error: firstError || 'Invalid profile name.' });
    }
    const updatedUser = await updateUserProfile(req.user.id, { name: parsed.data.name });
    return res.json({ user: updatedUser });
  } catch (err) {
    return next(err);
  }
});

router.put('/password', sensitiveAccountLimiter, requireAuth, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return res.status(400).json({ error: firstError || 'Invalid password input.' });
    }

    const strengthError = validatePasswordStrength(parsed.data.newPassword);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    await changeUserPassword(req.user.id, {
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      currentTokenHash: req.authTokenHash,
    });

    return res.json({ updated: true });
  } catch (err) {
    return next(err);
  }
});

router.delete('/account', sensitiveAccountLimiter, requireAuth, async (req, res, next) => {
  try {
    const parsed = deleteAccountSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return res.status(400).json({ error: firstError || 'Account deletion confirmation failed.' });
    }

    await deleteUserAccount(req.user.id, { password: parsed.data.password });
    clearAuthCookie(req, res);
    return res.json({ deleted: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
