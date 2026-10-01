import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Identity} from '../../middlewares/auth.middleware';
import {audit,HttpError,opaque} from '../../core/security';
import {readFacebookEnrollment} from './enrollment';
import {encryptMetaToken} from './security';
import type {FacebookPageAsset} from './facebook-assets';

/** Asset must come from server-side discovery with this enrollment's token, never from request JSON. */
export async function persistFacebookPage(db:PoolClient,actor:Identity,enrollmentId:string,asset:FacebookPageAsset,key:string) {
 const grant=await readFacebookEnrollment(db,actor,enrollmentId,key);
 // Serialize local asset selection/reconnect; global UNIQUE protects races across tenants.
 await db.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[actor.workspace_id]);
 const previous=(await db.query("SELECT id,channel_id FROM meta_connections WHERE workspace_id=$1 AND provider='facebook' AND asset_id=$2 FOR UPDATE",[actor.workspace_id,asset.id])).rows[0];
 const id=previous?.id||randomUUID(),channelId=previous?.channel_id||randomUUID();
 const ciphertext=encryptMetaToken(asset.pageToken,key,actor.workspace_id,asset.id);
 if(!previous) {
  await db.query(`INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,enabled,request_id,request_payload,transport)
   VALUES($1,$2,$3,'https://www.facebook.com','','#1877F2',$4,false,$5,$6,'facebook')`,
   [channelId,actor.workspace_id,asset.name,opaque(),randomUUID(),{provider:'facebook',assetId:asset.id}]);
  await db.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[actor.workspace_id,channelId,actor.user_id]);
  await db.query(`INSERT INTO meta_connections(id,workspace_id,channel_id,provider,asset_id,asset_name,token_ciphertext,granted_scopes,status,connected_by)
   VALUES($1,$2,$3,'facebook',$4,$5,$6,$7,'pending',$8)`,[id,actor.workspace_id,channelId,asset.id,asset.name,ciphertext,grant.scopes,actor.user_id]);
 } else {
  await db.query("UPDATE channels SET enabled=false WHERE workspace_id=$1 AND id=$2",[actor.workspace_id,channelId]);
  await db.query(`UPDATE meta_connections SET asset_name=$1,token_ciphertext=$2,granted_scopes=$3,status='pending',
   generation=generation+1,connected_by=$4,token_expires_at=NULL,updated_at=now() WHERE id=$5 AND workspace_id=$6`,
   [asset.name,ciphertext,grant.scopes,actor.user_id,id,actor.workspace_id]);
 }
 await db.query('DELETE FROM meta_enrollments WHERE id=$1 AND workspace_id=$2',[enrollmentId,actor.workspace_id]);
 await audit(db,actor.workspace_id,actor.user_id,previous?'meta.connection.reconnect_pending':'meta.connection.selected',id);
 return {id,channelId,status:'pending'};
}
