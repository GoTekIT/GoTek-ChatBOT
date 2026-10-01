import {signatureValid} from './webhook-security';
export {verifyMetaWebhook} from './webhook-security';
import {scope} from '../../core/db';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {uuid,HttpError} from '../../core/security';
import {createHash} from 'node:crypto';
import {appendMessage} from '../chat/chat-store';
import {enqueueJob} from '../jobs/jobs';
import {realtimeHub} from '../chat/realtime';

export async function receiveMetaWebhook(db:PoolClient,raw:Buffer,signature:string|undefined,afterCommit:Array<()=>void>=[]){
 if(!signatureValid(raw,signature))throw new HttpError(403,'META_SIGNATURE_INVALID');
 const body=z.object({object:z.string(),entry:z.array(z.object({id:z.string(),messaging:z.array(z.any()).optional()}).passthrough())}).passthrough().parse(JSON.parse(raw.toString('utf8')));
 if(body.object!=='page')return {accepted:true,processed:0}; let processed=0;
 for(const entry of body.entry){
  // Pilot routing is operator-provisioned; no tenant identifier from webhook input is trusted.
  const pageId=process.env.META_PAGE_ID;
  const workspace=process.env.META_WORKSPACE_ID;
  if(!pageId||!workspace)throw new HttpError(503,'META_ROUTING_NOT_CONFIGURED');
  if(entry.id!==pageId)continue;
  await scope(db,z.string().uuid().parse(workspace));
  const c=(await db.query('SELECT * FROM meta_connections WHERE external_page_id=$1 AND status=\'connected\' FOR UPDATE',[entry.id])).rows[0];if(!c)throw new HttpError(503,'META_CONNECTION_NOT_READY');
  for(const event of entry.messaging||[]){if(event?.message?.is_echo)continue;if(event?.recipient?.id!==entry.id)continue;const sender=event?.sender?.id;const mid=event?.message?.mid||event?.postback?.mid||event?.timestamp;if(!sender||!mid)continue;
   const eventKind=event?.message?'message':'event';const inserted=(await db.query('INSERT INTO meta_events(id,connection_id,external_event_id,event_kind,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id',[uuid(),c.id,String(mid),eventKind,event])).rowCount;if(!inserted)continue;
   if(event?.message?.text){const prof={externalId:String(sender),name:'Facebook user',source:'facebook_messenger'};await db.query('INSERT INTO meta_identities(id,connection_id,workspace_id,external_user_id,profile) VALUES($1,$2,$3,$4,$5) ON CONFLICT(connection_id,external_user_id) DO UPDATE SET profile=EXCLUDED.profile||meta_identities.profile,updated_at=now()',[uuid(),c.id,c.workspace_id,String(sender),prof]);
    const conv=(await db.query("SELECT c.id,c.visitor_id,c.owner_version,c.reply_owner FROM conversations c JOIN visitors v ON v.id=c.visitor_id WHERE c.workspace_id=$1 AND c.channel_id=$2 AND v.profile->>'metaUserId'=$3 ORDER BY c.updated_at DESC LIMIT 1",[c.workspace_id,c.channel_id,String(sender)])).rows[0];
    let conversation=conv;if(!conversation){const visitorId=uuid();conversation={id:uuid(),visitor_id:visitorId,owner_version:1,reply_owner:'AI_ACTIVE'};await db.query('INSERT INTO visitors(id,workspace_id,channel_id,token_hash,profile,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval \'30 days\')',[visitorId,c.workspace_id,c.channel_id,'meta:'+c.id+':'+sender,{...prof,metaUserId:String(sender)}]);await db.query('INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,\'AI_ACTIVE\')',[conversation.id,c.workspace_id,c.channel_id,visitorId]);}
    await enqueueJob(db,c.workspace_id,{kind:'meta.profile.fetch',key:`meta-profile:${c.id}:${sender}:${new Date().toISOString().slice(0,10)}`,payload:{connectionId:c.id,userId:String(sender)},external:false});
    // Derive a stable client id from the provider event so a retried webhook
    // cannot append the same visitor message twice after a partial failure.
    const digest=createHash('sha256').update(`${c.id}:${mid}`).digest('hex');
    const clientId=`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
    const msg=await appendMessage(db,{workspace:c.workspace_id,conversation:conversation.id,clientId,author:'visitor',visibility:'public',body:event.message.text});if(conversation.reply_owner==='AI_ACTIVE')await enqueueJob(db,c.workspace_id,{kind:'ai.reply',key:`conversation:${conversation.id}:message:${msg.id}`,payload:{conversationId:conversation.id,messageId:msg.id,ownerVersion:conversation.owner_version,requireGrounded:true},external:false});afterCommit.push(()=>{realtimeHub.broadcastToConversation(conversation.id,'message:new',msg);realtimeHub.broadcastToWorkspace(c.workspace_id,'inbox:visitor_message',{conversationId:conversation.id,source:'facebook_messenger',messageSnippet:event.message.text.slice(0,100),createdAt:msg.created_at});});
   } await db.query('UPDATE meta_events SET processed_at=now() WHERE connection_id=$1 AND external_event_id=$2',[c.id,String(mid)]);processed++;
  }
 } return {accepted:true,processed};
}
