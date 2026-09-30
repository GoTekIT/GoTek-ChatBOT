import type {PoolClient} from 'pg';
import {z} from 'zod';
import {audit,HttpError,requireRole} from '../core/security';
import {KnowledgeRepository} from '../repositories/knowledge.repository';
import type {Identity} from '../middlewares/auth.middleware';

export async function archiveKnowledge(db:PoolClient, actor:Identity, id:string, body:unknown) {
  requireRole(actor.role);
  const data=z.object({requestId:z.string().uuid(),expectedRevision:z.number().int().positive()}).strict().parse(body);
  const payload={id:z.string().uuid().parse(id),expectedRevision:data.expectedRevision};
  const operation='knowledge.archived';
  await KnowledgeRepository.lockKnowledgeMutation(db,actor.workspace_id,data.requestId);
  const prior=await KnowledgeRepository.findMutation(db,actor.workspace_id,data.requestId,payload);
  if(prior){if(prior.operation!==operation||!prior.same)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return prior.response;}
  const outcome=await KnowledgeRepository.archive(db,actor.workspace_id,id,data.expectedRevision);
  if(outcome.status==='missing')throw new HttpError(404,'NOT_FOUND');
  if(outcome.status==='conflict')throw new HttpError(409,'VERSION_CONFLICT');
  await audit(db,actor.workspace_id,actor.user_id,operation,id);
  await KnowledgeRepository.recordMutation(db,actor.workspace_id,data.requestId,operation,payload,outcome.result);
  return outcome.result;
}
