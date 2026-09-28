import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {requireRole} from '../security';
import {jobMetadata} from '../jobs';
import {getDataCollectionConfig, saveDataCollectionConfig, completeDataCollection} from '../data-collection';
import {createCitation, listCitations, revokeCitation} from '../active-citations';
import {createOnboardingSource, listOnboardingSources, setOnboardingReady} from '../onboarding';

export const miscRouter = Router();

miscRouter.get('/health', (_req, res) => {
  res.json({status: 'ok', environment: 'local-test', externalDelivery: false});
});

miscRouter.get(
  '/jobs',
  authed(async (db, i) => {
    requireRole(i.role);
    return jobMetadata(db, i.workspace_id);
  })
);

miscRouter.get(
  '/data-collection',
  authed((db, i) => getDataCollectionConfig(db, i))
);

miscRouter.put(
  '/data-collection',
  authed((db, i, req) => saveDataCollectionConfig(db, i, req.body))
);

miscRouter.post(
  '/data-collection/complete',
  authed(async (db, i, req) => completeDataCollection(db, i.workspace_id, req.body))
);

miscRouter.get(
  '/citations',
  authed((db, i) => listCitations(db, i))
);

miscRouter.post(
  '/citations',
  authed((db, i, req) => createCitation(db, i, req.body))
);

miscRouter.post(
  '/citations/:id/revoke',
  authed((db, i, req) => revokeCitation(db, i, String(req.params.id)))
);

miscRouter.get(
  '/onboarding/sources',
  authed((db, i) => listOnboardingSources(db, i))
);

miscRouter.post(
  '/onboarding/sources',
  authed((db, i, req) => createOnboardingSource(db, i, req.body))
);

miscRouter.post(
  '/onboarding/sources/:id/ready',
  authed((db, i, req) => setOnboardingReady(db, i, String(req.params.id)))
);
