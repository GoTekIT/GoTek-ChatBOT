import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

// Middlewares
import {identity, type Identity} from './middlewares/auth.middleware';
import {apiSecurityMiddleware, authRateLimit} from './middlewares/security.middleware';
import {notFoundHandler, errorHandler} from './middlewares/error.middleware';

// Widget & Public Endpoints
import {widgetRouter} from './modules/widget/widget';
import {widgetEmbed} from './modules/widget/widget-embed';

// Modular Domain Routers
import {authRouter} from './routes/auth.routes';
import {workspaceRouter} from './routes/workspace.routes';
import {memberRouter} from './routes/member.routes';
import {channelRouter} from './routes/channel.routes';
import {inboxRouter} from './routes/inbox.routes';
import {knowledgeRouter} from './routes/knowledge.routes';
import {webSourceRouter} from './routes/web-source.routes';
import {rulesRouter} from './routes/rules.routes';
import {contactRouter} from './routes/contact.routes';
import {auditRouter} from './routes/audit.routes';
import {supportRouter} from './routes/support.routes';
import {miscRouter} from './routes/misc.routes';
import {platformRoutes} from './modules/platform/platform';

// Re-export identity for backward compatibility with existing tests
export {identity, type Identity};

/**
 * GoTek Chatbot Application Composition Root
 * Clean Architecture & SOLID compliant modular Express application
 */
export function createApp() {
  const app = express();

  // Core security & parsing middlewares
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy: false}));
  app.use(express.json({limit: '128kb'}));
  app.use(cookieParser());

  // Public Widget SDK & Widget API routes
  app.get('/widget.js', widgetEmbed);
  app.use('/widget-api', widgetRouter());

  // Workspace API Security & Rate Limiting Pipeline
  app.use('/api', apiSecurityMiddleware);
  app.use('/api/auth', authRateLimit);

  // Mount Modular Domain Routers
  app.use('/api', authRouter);
  app.use('/api', workspaceRouter);
  app.use('/api', memberRouter);
  app.use('/api', channelRouter);
  app.use('/api', inboxRouter);
  app.use('/api', knowledgeRouter);
  app.use('/api', webSourceRouter);
  app.use('/api', rulesRouter);
  app.use('/api', contactRouter);
  app.use('/api', auditRouter);
  app.use('/api', supportRouter);
  app.use('/api', miscRouter);

  // Platform Admin routes
  platformRoutes(app);

  // 404 & Centralized Error Handling Middlewares
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
