import type {PoolClient} from 'pg';
import {z} from 'zod';
import {audit,HttpError,requireRole,uuid} from './security';

const sourceKey=z.string().trim().min(1).max(500);
type Actor={user_id:string;workspace_id:string;role:string};
const sourceInput=z.object({sourceKey,sourceType:z.enum(['KNOWLEDGE','WEB','LARK','FILE']),title:z.string().trim().min(1).max(300),canonicalUrl:z.string().url().max(2000).nullable().optional(),version:z.string().trim().min(1).max(100),audience:z.enum(['PUBLIC','INTERNAL']).default('INTERNAL')}).strict();

export async function registerCitationSource(db:PoolClient,actor:Actor,body:unknown){
 requireRole(actor.role);const d=sourceInput.parse(body);const row=(await db.query(`INSERT INTO active_citation_sources(id,workspace_id,source_key,source_type,title,canonical_url,version,audience,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,source_key,version) DO UPDATE SET title=EXCLUDED.title,canonical_url=EXCLUDED.canonical_url,audience=EXCLUDED.audience,active=true,revoked_at=NULL,revoked_by=NULL,updated_at=now() RETURNING id,source_key AS "sourceKey",source_type AS "sourceType",title,canonical_url AS "canonicalUrl",version,audience,active,revoked_at AS "revokedAt"`,[uuid(),actor.workspace_id,d.sourceKey,d.sourceType,d.title,d.canonicalUrl??null,d.version,d.audience,actor.user_id])).rows[0];
 await audit(db,actor.workspace_id,actor.user_id,'citation.source_registered',row.id);return row;
}
export async function revokeCitationSource(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role);z.string().uuid().parse(id);const row=(await db.query(`UPDATE active_citation_sources SET active=false,revoked_at=coalesce(revoked_at,now()),revoked_by=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING id`,[actor.workspace_id,id,actor.user_id])).rows[0];if(!row)throw new HttpError(404,'NOT_FOUND');await audit(db,actor.workspace_id,actor.user_id,'citation.source_revoked',id);return {ok:true};
}
export async function grantCitationAccess(db:PoolClient,actor:Actor,sourceId:string,userId:string){
 requireRole(actor.role);z.string().uuid().parse(sourceId);z.string().uuid().parse(userId);if(!(await db.query('SELECT id FROM active_citation_sources WHERE workspace_id=$1 AND id=$2 AND active',[actor.workspace_id,sourceId])).rowCount)throw new HttpError(404,'NOT_FOUND');if(!(await db.query('SELECT 1 FROM memberships WHERE workspace_id=$1 AND user_id=$2 AND active',[actor.workspace_id,userId])).rowCount)throw new HttpError(404,'NOT_FOUND');const row=(await db.query(`INSERT INTO active_citation_permissions(workspace_id,source_id,user_id,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT(source_id,user_id) DO UPDATE SET revoked_at=NULL,granted_by=EXCLUDED.granted_by,granted_at=now() RETURNING source_id AS "sourceId",user_id AS "userId"`,[actor.workspace_id,sourceId,userId,actor.user_id])).rows[0];await audit(db,actor.workspace_id,actor.user_id,'citation.permission_granted',sourceId);return row;
}
export async function revokeCitationAccess(db:PoolClient,actor:Actor,sourceId:string,userId:string){
 requireRole(actor.role);const row=(await db.query('UPDATE active_citation_permissions SET revoked_at=coalesce(revoked_at,now()) WHERE workspace_id=$1 AND source_id=$2 AND user_id=$3 RETURNING source_id',[actor.workspace_id,z.string().uuid().parse(sourceId),z.string().uuid().parse(userId)])).rows[0];if(!row)throw new HttpError(404,'NOT_FOUND');await audit(db,actor.workspace_id,actor.user_id,'citation.permission_revoked',sourceId);return {ok:true};
}
export async function recordCitation(db:PoolClient,actor:Actor,body:unknown){
 requireRole(actor.role);const d=z.object({answerId:z.string().uuid(),sourceId:z.string().uuid(),snippet:z.string().trim().min(1).max(2000),position:z.number().int().min(0).nullable().optional()}).strict().parse(body);const source=(await db.query('SELECT id FROM active_citation_sources WHERE workspace_id=$1 AND id=$2 AND active AND revoked_at IS NULL',[actor.workspace_id,d.sourceId])).rows[0];if(!source)throw new HttpError(409,'CITATION_SOURCE_UNAVAILABLE');const row=(await db.query(`INSERT INTO active_citations(id,workspace_id,answer_id,source_id,snippet,position) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,answer_id,source_id,position) DO UPDATE SET snippet=EXCLUDED.snippet RETURNING id,answer_id AS "answerId",source_id AS "sourceId",snippet,position`,[uuid(),actor.workspace_id,d.answerId,d.sourceId,d.snippet,d.position??null])).rows[0];return row;
}
export async function listAccessibleCitations(db:PoolClient,actor:Actor,answerId:string){
 z.string().uuid().parse(answerId);return (await db.query(`SELECT c.id,c.answer_id AS "answerId",c.source_id AS "sourceId",c.snippet,c.position,s.title,s.canonical_url AS "canonicalUrl",s.version,s.audience FROM active_citations c JOIN active_citation_sources s ON s.id=c.source_id AND s.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND c.answer_id=$2 AND c.revoked_at IS NULL AND s.active AND s.revoked_at IS NULL AND (s.audience='PUBLIC' OR EXISTS (SELECT 1 FROM active_citation_permissions p WHERE p.workspace_id=s.workspace_id AND p.source_id=s.id AND p.user_id=$3 AND p.revoked_at IS NULL)) ORDER BY c.position NULLS LAST,c.created_at,c.id`,[actor.workspace_id,answerId,actor.user_id])).rows;
}

// App route aliases kept deliberately small: retrieval callers should use the
// answer-scoped function above, while the settings surface can list/revoke rows.
export const createCitation=recordCitation;
export async function listCitations(db:PoolClient,actor:Actor){
 requireRole(actor.role);return (await db.query(`SELECT c.id,c.answer_id AS "answerId",c.source_id AS "sourceId",c.snippet,c.position,c.created_at AS "createdAt",s.title,s.canonical_url AS "canonicalUrl",s.version,s.audience FROM active_citations c JOIN active_citation_sources s ON s.id=c.source_id AND s.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND c.revoked_at IS NULL AND s.active AND s.revoked_at IS NULL ORDER BY c.created_at DESC LIMIT 200`,[actor.workspace_id])).rows;
}
export async function revokeCitation(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role);z.string().uuid().parse(id);const row=(await db.query('UPDATE active_citations SET revoked_at=coalesce(revoked_at,now()) WHERE workspace_id=$1 AND id=$2 RETURNING id',[actor.workspace_id,id])).rows[0];if(!row)throw new HttpError(404,'NOT_FOUND');await audit(db,actor.workspace_id,actor.user_id,'citation.revoked',id);return {ok:true};
}
