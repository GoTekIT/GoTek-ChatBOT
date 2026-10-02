import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {AiPipelineController} from '../controllers/ai-pipeline.controller';

export const aiRouter = Router();

// Ingest knowledge document text/markdown
aiRouter.post(
  '/ai/pipeline/ingest',
  authed((db, i, req) => AiPipelineController.ingestDocument(db, i, req), 'knowledge.manage')
);

// Semantic & lexical context retrieval
aiRouter.post(
  '/ai/pipeline/retrieve',
  authed((db, i, req) => AiPipelineController.retrieveContext(db, i, req), 'inbox.use')
);

// Grounded answer generation with citations & handoff checks
aiRouter.post(
  '/ai/pipeline/generate',
  authed((db, i, req) => AiPipelineController.generateAnswer(db, i, req), 'inbox.use')
);

// AI Playground test simulation without saving conversation
aiRouter.post(
  '/ai/pipeline/playground',
  authed((db, i, req) => AiPipelineController.testInPlayground(db, i, req), 'knowledge.manage')
);

// 1-Click teach FAQ from unanswered query
aiRouter.post(
  '/ai/pipeline/faq',
  authed((db, i, req) => AiPipelineController.teachFaq(db, i, req), 'knowledge.manage')
);
