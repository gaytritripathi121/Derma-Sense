import rateLimit from 'express-rate-limit';
import { getDatabaseStatus } from '../db/connection.js';
import { parseAuthCookie, resolveSessionUser } from '../services/authService.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please wait 15 minutes and try again.',
  },
});

export const sensitiveAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many account security requests. Please wait a few minutes and try again.',
  },
});

export async function attachAuthUser(req, _res, next) {
  try {
    const rawToken = parseAuthCookie(req);
    if (!rawToken) {
      req.user = null;
      req.authTokenHash = null;
      return next();
    }

    const resolved = await resolveSessionUser(rawToken);
    if (resolved) {
      req.user = resolved.user;
      req.authTokenHash = resolved.tokenHash;
    } else {
      req.user = null;
      req.authTokenHash = null;
    }
    return next();
  } catch {
    req.user = null;
    req.authTokenHash = null;
    return next();
  }
}

export function requireDatabase(req, res, next) {
  const dbStatus = getDatabaseStatus();
  if (!dbStatus.databaseConnected) {
    return res.status(503).json({
      error: dbStatus.databaseConfigured
        ? 'Database service is currently unavailable. You can still use DermaSense AI in Guest Mode.'
        : 'Account authentication requires MongoDB Atlas configuration (MONGODB_URI is not configured on the server). You can still use DermaSense AI in Guest Mode.',
      databaseConfigured: dbStatus.databaseConfigured,
      databaseConnected: false,
    });
  }
  return next();
}

export function requireAuth(req, res, next) {
  const dbStatus = getDatabaseStatus();
  if (!dbStatus.databaseConnected) {
    return res.status(503).json({
      error: dbStatus.databaseConfigured
        ? 'Database service is currently unavailable.'
        : 'Account authentication requires MongoDB Atlas configuration.',
      databaseConfigured: dbStatus.databaseConfigured,
      databaseConnected: false,
    });
  }

  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please log in to access this feature.',
    });
  }
  return next();
}
