import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {listRules, createRule, updateRule, setRuleState} from '../rules';
import {exportRules, importRules} from '../rules-transfer';

export const rulesRouter = Router();

rulesRouter.get(
  '/ai/rules',
  authed((db, i, req) => listRules(db, i, req.query))
);

rulesRouter.post(
  '/ai/rules',
  authed((db, i, req) => createRule(db, i, req.body))
);

rulesRouter.patch(
  '/ai/rules/:id',
  authed((db, i, req) => updateRule(db, i, String(req.params.id), req.body))
);

rulesRouter.patch(
  '/ai/rules/:id/state',
  authed((db, i, req) => setRuleState(db, i, String(req.params.id), req.body))
);

rulesRouter.get(
  '/ai/rules/export',
  authed((db, i) => exportRules(db, i))
);

rulesRouter.post(
  '/ai/rules/import',
  authed((db, i, req) => importRules(db, i, req.body))
);
