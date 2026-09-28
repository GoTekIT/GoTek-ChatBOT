import type {Request, Response, NextFunction} from 'express';
import multer from 'multer';
import {rateLimit} from 'express-rate-limit';
import {HttpError} from '../core/security';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2_000_000,
    files: 1,
    fields: 2,
    parts: 3,
    fieldSize: 4096
  }
});

export const uploadRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {error: 'RATE_LIMITED'}
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {error: 'RATE_LIMITED'}
});

export function apiSecurityMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    const allowed = process.env.APP_ORIGIN || 'http://127.0.0.1:4317';
    if ((origin && origin !== allowed) || req.get('x-gotek-request') !== '1') {
      return next(new HttpError(403, 'CSRF_REJECTED'));
    }
  }
  next();
}
