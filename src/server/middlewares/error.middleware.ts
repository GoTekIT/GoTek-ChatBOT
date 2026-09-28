import type {Request, Response, NextFunction} from 'express';
import multer from 'multer';
import {z} from 'zod';
import {HttpError} from '../security';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'NOT_FOUND'));
}

export function errorHandler(error: any, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof multer.MulterError) {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({error: error.code});
    return;
  }
  if (error instanceof z.ZodError) {
    res.status(400).json({error: 'VALIDATION', fields: error.flatten().fieldErrors});
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({error: error.code});
    return;
  }
  if (error.code === '23505') {
    res.status(409).json({error: 'CONFLICT'});
    return;
  }
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({error: 'INVALID_JSON'});
    return;
  }

  console.error(JSON.stringify({event: 'request.error', code: error.code || 'INTERNAL'}));
  res.status(500).json({error: 'INTERNAL'});
}
