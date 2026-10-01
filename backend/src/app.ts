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
import {metaWebhookRouter} from './modules/meta/webhook';

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
  app.use(helmet({contentSecurityPolicy: false}));
  app.use('/integrations/meta', metaWebhookRouter);
  app.use(express.json({limit: '128kb'}));
  app.use(cookieParser());

  // Root Service Status Page & Specs
  app.get('/', StatusController.getRoot);

  // Serve static assets (logo, icons, public sdk)
  app.use(express.static('public'));

  // Public Widget SDK & Widget API routes
  app.get('/widget.js', widgetEmbed);
  app.use('/widget-api', widgetRouter());

  // Workspace API Security & Rate Limiting Pipeline
  app.use('/api', apiSecurityMiddleware);
  app.use('/api/auth', authRateLimit);

  // Mount Centralized API Group Routes
  app.use('/api', apiRouter);

  // 404 & Centralized Error Handling Middlewares
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
