import {Router} from 'express';
import {authRouter} from './auth.routes';
import {workspaceRouter} from './workspace.routes';
import {memberRouter} from './member.routes';
import {channelRouter} from './channel.routes';
import {inboxRouter} from './inbox.routes';
import {knowledgeRouter} from './knowledge.routes';
import {webSourceRouter} from './web-source.routes';
import {rulesRouter} from './rules.routes';
import {contactRouter} from './contact.routes';
import {auditRouter} from './audit.routes';
import {supportRouter} from './support.routes';
import {platformRouter} from './platform.routes';
import {miscRouter} from './misc.routes';
import {metaRouter} from './meta.routes';

/**
 * Centralized API Group Router
 * Orchestrates all domain-specific routers into a unified route group
 */
export const apiRouter = Router();

// Modular Domain Route Groups
apiRouter.use(authRouter);
apiRouter.use(workspaceRouter);
apiRouter.use(memberRouter);
apiRouter.use(channelRouter);
apiRouter.use(inboxRouter);
apiRouter.use(knowledgeRouter);
apiRouter.use(webSourceRouter);
apiRouter.use(rulesRouter);
apiRouter.use(contactRouter);
apiRouter.use(auditRouter);
apiRouter.use(supportRouter);
apiRouter.use(platformRouter);
apiRouter.use(miscRouter);
apiRouter.use(metaRouter);
