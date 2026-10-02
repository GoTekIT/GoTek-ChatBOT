import type {PoolClient} from 'pg';
import {z} from 'zod';
import {requireRole,HttpError,audit,uuid} from '../../core/security';
import {META_CONNECTORS} from './connectors';

/** Inbox source catalog follows channel read permissions, including disconnected history. */
export async function listInboxSources(db:PoolClient, actor:{workspace_id:string;role:string;user_id:string}) {
 return (await db.query(`SELECT mc.id AS "connectionId",mc.channel_kind AS platform,
 mc.page_name AS "accountName",mc.external_page_id AS "externalAccountId",mc.status
 FROM meta_connections mc JOIN channels c ON c.id=mc.channel_id AND c.workspace_id=mc.workspace_id
 WHERE mc.workspace_id=$1 AND c.enabled AND
 ($2::boolean OR EXISTS(SELECT 1 FROM channel_members m WHERE m.workspace_id=mc.workspace_id
 AND m.channel_id=mc.channel_id AND m.user_id=$3)) ORDER BY mc.page_name,mc.id`,
 [actor.workspace_id,['Owner','Admin'].includes(actor.role),actor.user_id])).rows;
}

/** Workspace administration view. Token values and secret references never leave the server. */
export async function listMetaConnections(db:PoolClient, actor:{workspace_id:string;role:string}) {
 requireRole(actor.role);
 const connections=(await db.query(`SELECT id,channel_id,channel_kind,external_page_id,page_name,status,last_verified_at
 FROM meta_connections WHERE workspace_id=$1 ORDER BY created_at,id`,[actor.workspace_id])).rows;
 return {capabilities:META_CONNECTORS,connections};
}

/** Add a server-configured Meta account to this workspace. Secrets stay in env/secret storage. */
export async function createMetaConnection(db:PoolClient, actor:{workspace_id:string;role:string;user_id:string}, body:unknown) {
 requireRole(actor.role);
 const input=z.object({
  channelId:z.string().uuid(),
  platform:z.enum(['facebook_messenger','instagram_messaging','whatsapp_business','threads']),
  externalAccountId:z.string().trim().regex(/^\d{1,128}$/),
  accountName:z.string().trim().min(1).max(200),
  tokenRef:z.string().regex(/^META_[A-Z0-9_]+$/)
 }).strict().parse(body);
 if(!process.env[input.tokenRef]?.trim()) throw new HttpError(400,'META_TOKEN_REFERENCE_NOT_CONFIGURED');
 const channel=(await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 AND enabled FOR SHARE',[input.channelId,actor.workspace_id])).rows[0];
 if(!channel) throw new HttpError(404,'CHANNEL_NOT_FOUND');
 const occupied=(await db.query("SELECT id FROM meta_connections WHERE workspace_id=$1 AND channel_id=$2 AND status IN ('pending','connected','reauth_required','error') FOR SHARE",[actor.workspace_id,input.channelId])).rowCount;
 if(occupied) throw new HttpError(409,'META_CHANNEL_ALREADY_BOUND');
 const duplicate=(await db.query('SELECT workspace_id FROM meta_connections WHERE channel_kind=$1 AND external_page_id=$2 FOR SHARE',[input.platform,input.externalAccountId])).rows[0];
 if(duplicate) throw new HttpError(409,'META_ACCOUNT_ALREADY_CONNECTED');
 const id=uuid();
 try {
  await db.query(`INSERT INTO meta_connections(id,workspace_id,channel_id,channel_kind,external_page_id,page_name,page_access_token_ref,status,scopes)
   VALUES($1,$2,$3,$4,$5,$6,$7,'pending','[]'::jsonb)`,[id,actor.workspace_id,input.channelId,input.platform,input.externalAccountId,input.accountName,input.tokenRef]);
 } catch(error:any) {
  if(error?.code==='23505') throw new HttpError(409,'META_ACCOUNT_ALREADY_CONNECTED');
  throw error;
 }
 await audit(db,actor.workspace_id,actor.user_id,'meta.connection.created',id);
 return {id,status:'pending',platform:input.platform,externalAccountId:input.externalAccountId,accountName:input.accountName};
}

/** Verify the configured credential against Meta Graph; webhook subscription remains a separate live gate. */
export async function verifyMetaConnection(db:PoolClient, actor:{workspace_id:string;role:string;user_id:string}, id:string) {
 requireRole(actor.role);
 const row=(await db.query('SELECT id,page_access_token_ref,status FROM meta_connections WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[z.string().uuid().parse(id),actor.workspace_id])).rows[0];
 if(!row) throw new HttpError(404,'META_CONNECTION_NOT_FOUND');
 if(!process.env[row.page_access_token_ref]?.trim()) throw new HttpError(400,'META_TOKEN_REFERENCE_NOT_CONFIGURED');
 const connection=(await db.query('SELECT channel_kind,external_page_id FROM meta_connections WHERE id=$1 AND workspace_id=$2',[row.id,actor.workspace_id])).rows[0];
 if(connection.channel_kind==='threads') throw new HttpError(400,'META_CONNECTOR_NOT_AVAILABLE');
 const graphVersion=process.env.META_GRAPH_VERSION||'v20.0';
 const token=process.env[row.page_access_token_ref] as string;
 const fields=connection.channel_kind==='whatsapp_business'?'id,display_phone_number,verified_name':'id,name';
 let response:Response;
 try { response=await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(connection.external_page_id)}?fields=${encodeURIComponent(fields)}`,{redirect:'error',headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)}); }
 catch { throw new HttpError(400,'META_CREDENTIAL_VERIFY_FAILED'); }
 const body=await response.json().catch(()=>null);
 if(!response.ok||String(body?.id||'')!==connection.external_page_id) throw new HttpError(400,'META_CREDENTIAL_VERIFY_FAILED');
 await db.query("UPDATE meta_connections SET status='connected',last_verified_at=now(),updated_at=now() WHERE id=$1 AND workspace_id=$2",[row.id,actor.workspace_id]);
 await audit(db,actor.workspace_id,actor.user_id,'meta.connection.verified',row.id);
 return {id:row.id,status:'connected',verifiedAt:new Date().toISOString()};
}

/** Serializes with the dispatch lock; an already-dispatched request cannot be recalled. */
export async function disconnectMetaConnection(db:PoolClient, actor:{workspace_id:string;role:string;user_id:string}, id:string) {
 requireRole(actor.role);
 const connection=(await db.query('SELECT id,status FROM meta_connections WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[actor.workspace_id,z.string().uuid().parse(id)])).rows[0];
 if(!connection)throw new HttpError(404,'META_CONNECTION_NOT_FOUND');
 if(connection.status!=='disconnected'){
  await db.query("UPDATE meta_connections SET status='disconnected',updated_at=now() WHERE id=$1 AND workspace_id=$2",[connection.id,actor.workspace_id]);
  await audit(db,actor.workspace_id,actor.user_id,'meta.connection_disconnected',connection.id);
 }
 return {id:connection.id,status:'disconnected'};
}
