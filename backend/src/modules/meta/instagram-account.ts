import {HttpError} from '../../core/security';
import type {MetaConfig} from './config';
import type {InstagramGrant} from './instagram-oauth';
import {metaJsonRequest,type MetaFetch} from './http';
export interface InstagramAccount {id:string;username:string}
/** Resolve the webhook account ID from the grant's token, never a browser-supplied asset ID. */
export async function discoverInstagramAccount(config:MetaConfig,grant:InstagramGrant,request?:MetaFetch):Promise<InstagramAccount> {
 if(config.provider!=='instagram')throw new HttpError(400,'META_PROVIDER_INVALID');
 if(!grant.token||/[\r\n]/.test(grant.token))throw new HttpError(400,'META_TOKEN_INVALID');
 const url=new URL(`https://graph.instagram.com/${config.graphVersion}/me`);
 url.searchParams.set('fields','user_id,username');
 const result=await metaJsonRequest(url,{headers:{Authorization:`Bearer ${grant.token}`}},request);
 if(!Array.isArray(result.data)||result.data.length!==1||'user_id' in result)throw new HttpError(502,'META_RESPONSE_INVALID');
 const account=result.data[0];
 if(!account||typeof account.user_id!=='string'||!/^\d{1,100}$/.test(account.user_id)
  ||typeof account.username!=='string'||!account.username.trim()||account.username.length>255)throw new HttpError(502,'META_RESPONSE_INVALID');
 // user_id is the professional account ID used in webhook entry.id; OAuth's userId is not used as asset authority.
 return {id:account.user_id,username:account.username};
}
