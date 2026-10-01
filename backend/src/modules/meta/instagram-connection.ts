import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Identity} from '../../middlewares/auth.middleware';
import {requirePermission} from '../../core/authorization';
import {audit,opaque,HttpError} from '../../core/security';
import {encryptMetaToken} from './security';
import type {InstagramGrant} from './instagram-oauth';
import type {InstagramAccount} from './instagram-account';
/** Only server-discovered account and grant; caller revalidates identity after network calls. */
export async function persistInstagramConnection(db:PoolClient,actor:Identity,grant:InstagramGrant,account:InstagramAccount,key:string,expiresAt:Date) {
 requirePermission(actor.role,'channels.manage');
 if(!Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=Date.now())throw new HttpError(409,'META_RECONNECT_REQUIRED');
 await db.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[actor.workspace_id]);
 const previous=(await db.query("SELECT id,channel_id FROM meta_connections WHERE workspace_id=$1 AND provider='instagram' AND asset_id=$2 FOR UPDATE",[actor.workspace_id,account.id])).rows[0];
 const id=previous?.id||randomUUID(),channelId=previous?.channel_id||randomUUID();
 const encrypted=encryptMetaToken(grant.token,key,actor.workspace_id,account.id);
 if(!previous){
  await db.query(`INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,enabled,request_id,request_payload,transport)
   VALUES($1,$2,$3,'https://www.instagram.com','','#C13584',$4,false,$5,$6,'instagram')`,
   [channelId,actor.workspace_id,account.username,opaque(),randomUUID(),{provider:'instagram',assetId:account.id}]);
  await db.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[actor.workspace_id,channelId,actor.user_id]);
  await db.query(`INSERT INTO meta_connections(id,workspace_id,channel_id,provider,asset_id,asset_name,token_ciphertext,granted_scopes,token_expires_at,status,connected_by)
   VALUES($1,$2,$3,'instagram',$4,$5,$6,$7,$8,'pending',$9)`,[id,actor.workspace_id,channelId,account.id,account.username,encrypted,grant.scopes,expiresAt,actor.user_id]);
 }else{
  await db.query('UPDATE channels SET enabled=false WHERE workspace_id=$1 AND id=$2',[actor.workspace_id,channelId]);
  await db.query(`UPDATE meta_connections SET asset_name=$1,token_ciphertext=$2,granted_scopes=$3,token_expires_at=$4,status='pending',
   generation=generation+1,connected_by=$5,updated_at=now() WHERE id=$6 AND workspace_id=$7`,[account.username,encrypted,grant.scopes,expiresAt,actor.user_id,id,actor.workspace_id]);
 }
 await audit(db,actor.workspace_id,actor.user_id,previous?'meta.connection.reconnect_pending':'meta.connection.selected',id);
 return {id,channelId,status:'pending',provider:'instagram',assetId:account.id,assetName:account.username};
}
