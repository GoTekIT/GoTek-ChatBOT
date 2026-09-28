import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {listAuditEvents} from '../audit-log';
import {exportAuditEvents} from '../audit-export';

export const auditRouter = Router();

export const auditSubRouter = Router();

auditRouter.get(
  '/audit/export',
  authed((db, i, req) => exportAuditEvents(db, i, req.query))
);

auditRouter.get(
  '/audit',
  authed((db, i, req) => listAuditEvents(db, i, req.query))
);
