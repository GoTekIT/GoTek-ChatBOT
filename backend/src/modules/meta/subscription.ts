import {createHmac} from 'node:crypto';
import type {Request} from 'express';
import {transaction} from '../../core/db';
import {identity} from '../../middlewares/auth.middleware';
import {requirePermission} from '../../core/authorization';
import {HttpError,audit} from '../../core/security';
import {metaConfig} from './config';
import {metaEncryptionKey} from './enrollment';
import {decryptMetaToken} from './security';
import {metaJsonRequest} from './http';
import {z} from 'zod';

export async function activateFacebookConnection(req:Request,id:string) {
 z.string().uuid().parse(id);
 const config=metaConfig('facebook'),key=metaEncryptionKey();
 const original=await transaction(async db=>{
  const actor=await identity(db,req);requirePermission(actor.role,'channels.manage');
  const row=(await db.query("SELECT * FROM meta_connections WHERE workspace_id=$1 AND id=$2 AND provider='facebook' FOR UPDATE",[actor.workspace_id,id])).rows[0];
  if(!row)throw new HttpError(404,'META_CONNECTION_NOT_FOUND');
  if(row.token_expires_at && new Date(row.token_expires_at).getTime()<=Date.now())throw new HttpError(409,'META_RECONNECT_REQUIRED');
  if(row.status==='active')return {actor,row,active:true};
  if(row.status!=='pending'||!row.token_ciphertext)throw new HttpError(409,'META_RECONNECT_REQUIRED');
  if(!row.granted_scopes.includes('pages_manage_metadata'))throw new HttpError(403,'META_PERMISSIONS_REQUIRED');
  return {actor,row,active:false};
 });
 if(original.active)return {id,status:'active'};
 let token:string;
 try{token=decryptMetaToken(original.row.token_ciphertext,key,original.actor.workspace_id,original.row.asset_id);}
 catch{throw new HttpError(503,'META_CREDENTIAL_UNAVAILABLE');}
 const url=new URL(`https://graph.facebook.com/${config.graphVersion}/${original.row.asset_id}/subscribed_apps`);
 const body=new URLSearchParams({subscribed_fields:'messages,messaging_postbacks,message_deliveries,message_reads',appsecret_proof:createHmac('sha256',config.appSecret).update(token).digest('hex')});
 const result=await metaJsonRequest(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/x-www-form-urlencoded'},body});
 if(result.success!==true)throw new HttpError(502,'META_SUBSCRIPTION_UNCONFIRMED');
 return transaction(async db=>{
  const actor=await identity(db,req);requirePermission(actor.role,'channels.manage');
  if(actor.user_id!==original.actor.user_id || actor.workspace_id!==original.actor.workspace_id || actor.token_hash!==original.actor.token_hash)throw new HttpError(403,'META_IDENTITY_CHANGED');
  const row=(await db.query('SELECT status,generation,channel_id,token_expires_at FROM meta_connections WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[actor.workspace_id,id])).rows[0];
  if(!row || row.generation!==original.row.generation || !['pending','active'].includes(row.status))throw new HttpError(409,'META_CONNECTION_CHANGED');
  if(row.token_expires_at && new Date(row.token_expires_at).getTime()<=Date.now())throw new HttpError(409,'META_RECONNECT_REQUIRED');
  if(row.status==='pending') {
   await db.query("UPDATE meta_connections SET status='active',updated_at=now() WHERE id=$1 AND workspace_id=$2",[id,actor.workspace_id]);
   await db.query('UPDATE channels SET enabled=true WHERE id=$1 AND workspace_id=$2',[row.channel_id,actor.workspace_id]);
   await audit(db,actor.workspace_id,actor.user_id,'meta.connection.activated',id);
  }
  return {id,status:'active'};
 });
}
