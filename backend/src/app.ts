import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Middlewares
import {identity, type Identity} from './middlewares/auth.middleware';
import {apiSecurityMiddleware, authRateLimit} from './middlewares/security.middleware';
import {notFoundHandler, errorHandler} from './middlewares/error.middleware';
import {requestLogger} from './middlewares/logger.middleware';
import {StatusController} from './controllers/status.controller';

// Widget & Public Endpoints
import {widgetRouter} from './modules/widget/widget';
import {widgetEmbed} from './modules/widget/widget-embed';

// Modular Domain Routers
import {apiRouter} from './routes/index';
import {metaRouter} from './routes/meta.routes';

// Re-export identity for backward compatibility with existing tests
export {identity, type Identity};

/**
 * GoTek Chatbot Application Composition Root
 * Clean Architecture & SOLID compliant modular Express application
 */
export function createApp() {
  const app = express();

  // Core logging middleware for Docker console stdout
  app.use(requestLogger);

  // Core security & parsing middlewares
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(express.json({limit: '128kb', verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); }}));
  app.use(cookieParser());

  // Root Service Status Page & Specs
  app.get('/', StatusController.getRoot);
  app.get('/privacy', (_req, res) => res.type('html').send('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Chính sách quyền riêng tư GoTek Chatbot</title></head><body><main><h1>Chính sách quyền riêng tư GoTek Chatbot</h1><p>GoTek Chatbot xử lý dữ liệu hội thoại và thông tin liên hệ do người dùng chủ động cung cấp để hỗ trợ chăm sóc khách hàng.</p><h2>Dữ liệu được xử lý</h2><p>Tin nhắn, tên hiển thị, ảnh đại diện và mã định danh nền tảng được dùng để hiển thị hội thoại cho nhân viên được phân quyền.</p><h2>Quyền kiểm soát</h2><p>Người dùng có thể yêu cầu truy cập, chỉnh sửa hoặc xoá dữ liệu qua quản trị viên của doanh nghiệp vận hành kênh.</p><h2>Liên hệ</h2><p>Liên hệ quản trị viên GoTek để được hỗ trợ về dữ liệu và quyền riêng tư.</p></main></body></html>'));

  // Serve static assets (logo, icons, public sdk) with Cross-Origin headers
  app.use(express.static('public', {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }));

  // Public Widget SDK & Widget API routes
  app.get('/widget.js', widgetEmbed);
  app.use('/widget-api', widgetRouter());

  // Workspace API Security & Rate Limiting Pipeline
  app.use('/api', apiSecurityMiddleware);
  app.use('/api/auth', authRateLimit);

  // Mount Centralized API Group Routes
  app.use('/api', apiRouter);
  app.use(metaRouter);

  // 404 & Centralized Error Handling Middlewares
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
