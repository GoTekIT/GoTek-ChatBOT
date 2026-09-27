import type {PoolClient} from 'pg';import {z} from 'zod';import {audit,HttpError,uuid,requireRole} from './security';
export type SupportActor={user_id:string,workspace_id:string,role:string};
export async function listSupport(db:PoolClient,actor:SupportActor){requireRole(actor.role);return (await db.query('SELECT id,subject_id,scope,reason,expires_at,revoked_at,created_at FROM support_grants WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100',[actor.workspace_id])).rows;}
export async function createSupport(db:PoolClient,actor:SupportActor,body:unknown){requireRole(actor.role);const data=z.object({subjectId:z.string().uuid(),scope:z.literal('operational_metadata'),reason:z.string().trim().min(5).max(500),minutes:z.number().int().min(5).max(60)}).strict().parse(body);
 if(!(await db.query('SELECT 1 FROM platform_admins WHERE user_id=$1 AND active',[data.subjectId])).rowCount)throw new HttpError(400,'SUPPORT_SUBJECT_UNAVAILABLE');
 const grant=(await db.query("INSERT INTO support_grants(id,workspace_id,subject_id,created_by,scope,reason,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+make_interval(mins=>$7)) RETURNING id,scope,expires_at",[uuid(),actor.workspace_id,data.subjectId,actor.user_id,data.scope,data.reason,data.minutes])).rows[0];await audit(db,actor.workspace_id,actor.user_id,'support.granted',grant.id);return grant;
}
export async function revokeSupport(db:PoolClient,actor:SupportActor,grantId:string){requireRole(actor.role);z.string().uuid().parse(grantId);if(!(await db.query('UPDATE support_grants SET revoked_at=coalesce(revoked_at,now()) WHERE id=$1 AND workspace_id=$2 RETURNING id',[grantId,actor.workspace_id])).rowCount)throw new HttpError(404,'NOT_FOUND');await audit(db,actor.workspace_id,actor.user_id,'support.revoked',grantId);return {ok:true};}
export async function supportMetadata(db:PoolClient,actor:string,grantId:string){z.string().uuid().parse(grantId);await db.query("SELECT set_config('app.actor_id',$1,true)",[actor]);
 const grant=(await db.query("SELECT * FROM support_grants WHERE id=$1 AND subject_id=$2 AND scope='operational_metadata' AND revoked_at IS NULL AND expires_at>clock_timestamp()",[grantId,actor])).rows[0];if(!grant)throw new HttpError(403,'SUPPORT_GRANT_UNAVAILABLE');
 await db.query("SELECT set_config('app.workspace_id',$1,true)",[grant.workspace_id]);
 if(!(await db.query('SELECT id FROM support_grants WHERE id=$1 AND subject_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE',[grantId,actor])).rowCount)throw new HttpError(403,'SUPPORT_GRANT_UNAVAILABLE');
 const workspace=(await db.query('SELECT id,name,status FROM workspaces WHERE id=$1',[grant.workspace_id])).rows[0];
 const jobs=(await db.query('SELECT state,count(*)::int AS count FROM jobs GROUP BY state ORDER BY state')).rows;
 await audit(db,grant.workspace_id,actor,'support.metadata_viewed',grantId);return {workspace,jobs,scope:grant.scope,expiresAt:grant.expires_at};
}
