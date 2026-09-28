import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {listSupport, createSupport, revokeSupport} from '../modules/support/support';

export const supportRouter = Router();

supportRouter.get(
  '/support-grants',
  authed((db, i) => listSupport(db, i))
);

supportRouter.post(
  '/support-grants',
  authed((db, i, req) => createSupport(db, i, req.body))
);

supportRouter.post(
  '/support-grants/:id/revoke',
  authed((db, i, req) => revokeSupport(db, i, String(req.params.id)))
);
