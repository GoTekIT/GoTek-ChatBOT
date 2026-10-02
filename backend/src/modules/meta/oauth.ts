import {metaGraphVersion} from './graph-version';
import {createMetaConnection,verifyMetaConnection,subscribeMetaWebhook} from './connections';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import type {Identity} from '../../middlewares/auth.middleware';
import {audit,digest,HttpError,opaque,requireRole,uuid} from '../../core/security';
import {openMetaSecret,sealMetaSecret,storeMetaCredential} from './credential-vault';

const accountSchema=z.object({id:z.string().regex(/^\d{1,128}$/),name:z.string().min(1).max(200),access_token:z.string().min(1).max(16384)});
const accountList=z.array(accountSchema).max(500);
const secretContext=(workspace:string,id:string)=>`meta-oauth-accounts:${workspace}:${id}`;
function config(){
 const appId=process.env.META_APP_ID,secret=process.env.META_APP_SECRET,redirect=process.env.META_OAUTH_REDIRECT_URI;
 if(!appId||!/^\d+$/.test(appId)||!secret||!redirect)throw new HttpError(503,'META_OAUTH_NOT_CONFIGURED');
 let uri:URL;try{uri=new URL(redirect);}catch{throw new HttpError(503,'META_OAUTH_NOT_CONFIGURED');}
 if(uri.username||uri.password||uri.search||uri.hash||uri.pathname!=='/api/meta/oauth/callback'||(uri.protocol!=='https:'&&!(uri.protocol==='http:'&&['localhost','127.0.0.1'].includes(uri.hostname))))throw new HttpError(503,'META_OAUTH_REDIRECT_INVALID');
 const version=metaGraphVersion();
 return {appId,secret,redirect:uri.href,version};
}
export async function beginFacebookOAuth(db:PoolClient,actor:Identity){
 requireRole(actor.role);const c=config();
 // Fail before redirect when encryption is unavailable.
 sealMetaSecret('configuration-check','meta-oauth-check');
 const state=opaque(),id=uuid();
 await db.query('DELETE FROM meta_oauth_sessions WHERE workspace_id=$1 AND expires_at<=now()',[actor.workspace_id]);
 await db.query(`INSERT INTO meta_oauth_sessions(id,workspace_id,user_id,session_hash,state_hash,redirect_uri)
 VALUES($1,$2,$3,$4,$5,$6)`,[id,actor.workspace_id,actor.user_id,actor.token_hash,digest(state),c.redirect]);
 const url=new URL(`https://www.facebook.com/${c.version}/dialog/oauth`);
 url.search=new URLSearchParams({client_id:c.appId,redirect_uri:c.redirect,state,response_type:'code',scope:'pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement'}).toString();
 return {authorizationUrl:url.href};
}
async function graphJson(url:string,init:RequestInit,transport:typeof fetch){
 let response:Response;
 try{response=await transport(url,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(502,'META_OAUTH_PROVIDER_UNAVAILABLE');}
 const body=await response.json().catch(()=>null);
 if(!response.ok||!body||body.error)throw new HttpError(502,'META_OAUTH_PROVIDER_REJECTED');
 return body;
}
export async function completeFacebookOAuth(db:PoolClient,actor:Identity,query:unknown,transport:typeof fetch=fetch){
 requireRole(actor.role);
 const input=z.object({state:z.string().min(20).max(512),code:z.string().min(1).max(4096).optional(),error:z.string().optional()}).passthrough().parse(query);
 const c=config();
 const row=(await db.query(`SELECT id,redirect_uri FROM meta_oauth_sessions WHERE workspace_id=$1 AND user_id=$2
 AND session_hash=$3 AND state_hash=$4 AND status='pending' AND expires_at>now() FOR UPDATE`,
 [actor.workspace_id,actor.user_id,actor.token_hash,digest(input.state)])).rows[0];
 if(!row)throw new HttpError(409,'META_OAUTH_STATE_INVALID');
 if(input.error||!input.code)throw new HttpError(400,'META_OAUTH_CANCELLED');
 if(row.redirect_uri!==c.redirect)throw new HttpError(409,'META_OAUTH_REDIRECT_CHANGED');
 const exchange=new URL(`https://graph.facebook.com/${c.version}/oauth/access_token`);
 exchange.search=new URLSearchParams({client_id:c.appId,client_secret:c.secret,redirect_uri:c.redirect,code:input.code}).toString();
 const result=await graphJson(exchange.href,{},transport);
 if(typeof result.access_token!=='string'||!result.access_token)throw new HttpError(502,'META_OAUTH_TOKEN_MISSING');
 const accounts:unknown[]=[];const seen=new Set<string>();
 let next=`https://graph.facebook.com/${c.version}/me/accounts?fields=id,name,access_token,tasks&limit=100`;
 while(next){
  let url:URL;try{url=new URL(next);}catch{throw new HttpError(502,'META_OAUTH_PAGING_INVALID');}
  if(url.protocol!=='https:'||url.hostname!=='graph.facebook.com'||url.username||url.password)throw new HttpError(502,'META_OAUTH_PAGING_INVALID');
  url.searchParams.delete('access_token');
  if(seen.has(url.href)||seen.size>=20)throw new HttpError(502,'META_OAUTH_PAGING_INVALID');
  seen.add(url.href);
  const body=await graphJson(url.href,{headers:{authorization:`Bearer ${result.access_token}`}},transport);
  if(!Array.isArray(body.data))throw new HttpError(502,'META_OAUTH_ACCOUNTS_INVALID');
  accounts.push(...body.data);if(accounts.length>500)throw new HttpError(502,'META_OAUTH_ACCOUNT_LIMIT');
  next=typeof body.paging?.next==='string'?body.paging.next:'';
 }
 const parsed=accountList.safeParse(accounts);
 if(!parsed.success)throw new HttpError(502,'META_OAUTH_ACCOUNTS_INVALID');
 const unique=[...new Map(parsed.data.map(account=>[account.id,account])).values()];
 await db.query("UPDATE meta_oauth_sessions SET status='ready',encrypted_accounts=$1 WHERE id=$2 AND workspace_id=$3",[sealMetaSecret(JSON.stringify(unique),secretContext(actor.workspace_id,row.id)),row.id,actor.workspace_id]);
 await audit(db,actor.workspace_id,actor.user_id,'meta.oauth.authorized',row.id);
 return {sessionId:row.id};
}
export async function facebookOAuthAccounts(db:PoolClient,actor:Identity,id:string){
 requireRole(actor.role);
 const row=(await db.query(`SELECT encrypted_accounts FROM meta_oauth_sessions WHERE id=$1 AND workspace_id=$2
 AND user_id=$3 AND session_hash=$4 AND status='ready' AND expires_at>now()`,[z.string().uuid().parse(id),actor.workspace_id,actor.user_id,actor.token_hash])).rows[0];
 if(!row)throw new HttpError(404,'META_OAUTH_SESSION_UNAVAILABLE');
 const accounts=accountList.parse(JSON.parse(openMetaSecret(row.encrypted_accounts,secretContext(actor.workspace_id,id))));
 return {sessionId:id,accounts:accounts.map(({id,name})=>({id,name}))};
}

/** Link one selected Page per transaction; UI can select several and show each result. */
export async function selectFacebookOAuthAccount(db:PoolClient,actor:Identity,id:string,body:unknown){
 requireRole(actor.role);
 const input=z.object({accountId:z.string().regex(/^\d{1,128}$/)}).strict().parse(body);
 const row=(await db.query(`SELECT encrypted_accounts FROM meta_oauth_sessions WHERE id=$1 AND workspace_id=$2
 AND user_id=$3 AND session_hash=$4 AND status='ready' AND expires_at>now() FOR UPDATE`,[z.string().uuid().parse(id),actor.workspace_id,actor.user_id,actor.token_hash])).rows[0];
 if(!row)throw new HttpError(404,'META_OAUTH_SESSION_UNAVAILABLE');
 const accounts=accountList.parse(JSON.parse(openMetaSecret(row.encrypted_accounts,secretContext(actor.workspace_id,id))));
 const account=accounts.find(item=>item.id===input.accountId);
 if(!account)throw new HttpError(400,'META_OAUTH_ACCOUNT_NOT_OFFERED');
 const existing=(await db.query("SELECT id,channel_id FROM meta_connections WHERE workspace_id=$1 AND channel_kind='facebook_messenger' AND external_page_id=$2",[actor.workspace_id,account.id])).rows[0];
 let connectionId:string;
 if(existing){
  connectionId=existing.id;
  // Match verification lock order: channel first, then connection.
  await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[existing.channel_id,actor.workspace_id]);
  await db.query('SELECT id FROM meta_connections WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[connectionId,actor.workspace_id]);
  await storeMetaCredential(db,actor.workspace_id,connectionId,account.access_token);
 }else{
  connectionId=(await createMetaConnection(db,actor,{platform:'facebook_messenger',externalAccountId:account.id,accountName:account.name,tokenRef:'META_OAUTH_MANAGED'},account.access_token)).id;
 }
 await verifyMetaConnection(db,actor,connectionId);
 await subscribeMetaWebhook(db,actor,connectionId);
 await db.query('UPDATE meta_connections SET page_name=$1 WHERE workspace_id=$2 AND id=$3',[account.name,actor.workspace_id,connectionId]);
 const remaining=accounts.filter(item=>item.id!==account.id);
 await db.query('UPDATE meta_oauth_sessions SET encrypted_accounts=$1 WHERE id=$2 AND workspace_id=$3',[sealMetaSecret(JSON.stringify(remaining),secretContext(actor.workspace_id,id)),id,actor.workspace_id]);
 await audit(db,actor.workspace_id,actor.user_id,'meta.oauth.page_connected',connectionId);
 return {connectionId,accountId:account.id,accountName:account.name,status:'connected'};
}
