import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {readSchedule, setSchedule} from '../modules/web-sources/web-source-schedule';
import {
  listWebSources,
  createWebSource,
  setWebSourceStatus,
  previewWebSource,
  requestWebSourceRefresh,
  listWebSourceSnapshots,
  readWebSourceSnapshot
} from '../modules/web-sources/web-sources';
import {createWebGeneration, publishWebGeneration, rollbackWebGeneration} from '../modules/web-sources/web-generations';
import {importWebSnapshotKnowledge} from '../modules/web-sources/web-snapshot-knowledge';
import {stageWebSnapshotGeneration} from '../modules/web-sources/web-snapshot-generation';

export const webSourceRouter = Router();

webSourceRouter.get(
  '/web-sources/:id/schedule',
  authed((db, i, req) => readSchedule(db, i, String(req.params.id)))
);

webSourceRouter.patch(
  '/web-sources/:id/schedule',
  authed((db, i, req) => setSchedule(db, i, String(req.params.id), req.body))
);

webSourceRouter.get(
  '/web-sources',
  authed((db, i) => listWebSources(db, i))
);

webSourceRouter.post(
  '/web-sources',
  authed((db, i, req) => createWebSource(db, i, req.body))
);

webSourceRouter.patch(
  '/web-sources/:id/status',
  authed((db, i, req) => setWebSourceStatus(db, i, String(req.params.id), req.body))
);

webSourceRouter.get(
  '/web-sources/:id/snapshots',
  authed((db, i, req) => listWebSourceSnapshots(db, i, String(req.params.id)))
);

webSourceRouter.get(
  '/web-sources/:id/snapshots/:snapshotId',
  authed((db, i, req) => readWebSourceSnapshot(db, i, String(req.params.id), String(req.params.snapshotId)))
);

webSourceRouter.post(
  '/web-sources/generations',
  authed((db, i, req) => createWebGeneration(db, i, req.body))
);

webSourceRouter.post(
  '/web-sources/generations/:generationId/publish',
  authed((db, i, req) => publishWebGeneration(db, i, String(req.params.generationId), req.body))
);

webSourceRouter.post(
  '/web-sources/generations/:generationId/rollback',
  authed((db, i, req) => rollbackWebGeneration(db, i, String(req.params.generationId), req.body))
);

webSourceRouter.post(
  '/web-sources/:id/snapshots/:snapshotId/knowledge-drafts',
  authed((db, i, req) =>
    importWebSnapshotKnowledge(db, i, String(req.params.id), String(req.params.snapshotId), req.body)
  )
);

webSourceRouter.post(
  '/web-sources/:id/snapshots/:snapshotId/generation-draft',
  authed((db, i, req) =>
    stageWebSnapshotGeneration(db, i, String(req.params.id), String(req.params.snapshotId), req.body)
  )
);

webSourceRouter.post(
  '/web-sources/:id/refresh',
  authed((db, i, req) => requestWebSourceRefresh(db, i, String(req.params.id), req.body))
);

webSourceRouter.post(
  '/web-sources/:id/preview',
  authed((db, i, req) => previewWebSource(db, i, String(req.params.id)))
);
