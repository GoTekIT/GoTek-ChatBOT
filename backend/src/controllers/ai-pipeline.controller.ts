import {ingestSchema,retrieveSchema,generateSchema,playgroundSchema,teachFaqSchema} from '../dtos/ai-pipeline.dto';
import type {Request} from 'express';
import type {PoolClient} from 'pg';
import {AiPipelineService} from '../services/ai-pipeline.service';
import type {Identity} from '../middlewares/auth.middleware';

export class AiPipelineController {
  static async ingestDocument(db: PoolClient, i: Identity, req: Request): ReturnType<typeof AiPipelineService.ingestDocument> {
    const payload = ingestSchema.parse(req.body);
    return AiPipelineService.ingestDocument(db, i.workspace_id, i.user_id, payload);
  }

  static async retrieveContext(db: PoolClient, i: Identity, req: Request): ReturnType<typeof AiPipelineService.retrieveContext> {
    const payload = retrieveSchema.parse(req.body);
    return AiPipelineService.retrieveContext(db, i.workspace_id, payload);
  }

  static async generateAnswer(db: PoolClient, i: Identity, req: Request): ReturnType<typeof AiPipelineService.generateAnswer> {
    const payload = generateSchema.parse(req.body);
    return AiPipelineService.generateAnswer(db, i.workspace_id, payload);
  }

  static async testInPlayground(db: PoolClient, i: Identity, req: Request): ReturnType<typeof AiPipelineService.testInPlayground> {
    const {question} = playgroundSchema.parse(req.body);
    return AiPipelineService.testInPlayground(db, i.workspace_id, question);
  }

  static async teachFaq(db: PoolClient, i: Identity, req: Request): ReturnType<typeof AiPipelineService.teachFaq> {
    const payload = teachFaqSchema.parse(req.body);
    return AiPipelineService.teachFaq(db, i.workspace_id, i.user_id, payload);
  }
}
