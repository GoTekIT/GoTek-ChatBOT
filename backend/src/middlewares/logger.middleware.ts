import type {Request, Response, NextFunction} from 'express';

/**
 * Standard HTTP Request Logger Middleware for GoTek Chatbot
 * Outputs structured, color-coded access logs directly to Docker container stdout
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const {method, originalUrl} = req;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // ANSI Color codes for Docker terminal output
    const color =
      status >= 500
        ? '\x1b[31m' // Red
        : status >= 400
        ? '\x1b[33m' // Yellow
        : status >= 300
        ? '\x1b[36m' // Cyan
        : '\x1b[32m'; // Green
    const reset = '\x1b[0m';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    console.log(
      `[HTTP] ${timestamp} | ${method.padEnd(6)} | ${color}${status} ${res.statusMessage || ''}${reset} | ${duration.toString().padStart(4)}ms | ${originalUrl} | IP: ${clientIp}`
    );
  });

  next();
}
