import {HttpError} from '../../core/security';
import type {MetaConfig} from './config';
import {metaJsonRequest,type MetaFetch} from './http';
export interface InstagramGrant {token:string;userId:string;expiresIn:number;scopes:string[]}
function validToken(value:unknown):value is string {
 return typeof value==='string' && value.length>0 && value.length<=16384 && !/[\r\n]/.test(value);
}
/** Server-only Instagram Login exchange. OAuth state must already be consumed and committed. */
export async function exchangeInstagramCode(config:MetaConfig,code:string,request?:MetaFetch):Promise<InstagramGrant> {
 if(config.provider!=='instagram')throw new HttpError(400,'META_PROVIDER_INVALID');
 if(!code||code.length>8192||/[\r\n]/.test(code))throw new HttpError(400,'META_CODE_INVALID');
 const form=new FormData();
 for(const [key,value] of Object.entries({client_id:config.appId,client_secret:config.appSecret,grant_type:'authorization_code',redirect_uri:config.redirectUri,code}))form.set(key,value);
 const short=await metaJsonRequest(new URL('https://api.instagram.com/oauth/access_token'),{method:'POST',body:form},request);
 if(!Array.isArray(short.data)||short.data.length!==1||'access_token' in short)throw new HttpError(502,'META_RESPONSE_INVALID');
 const entry=short.data[0];
 if(!entry||!validToken(entry.access_token)||typeof entry.user_id!=='string'||!/^\d{1,100}$/.test(entry.user_id)
  ||typeof entry.permissions!=='string'||entry.permissions.length>4096)throw new HttpError(502,'META_RESPONSE_INVALID');
 const scopes=[...new Set<string>(entry.permissions.split(',').map((s:string)=>s.trim()).filter(Boolean))];
 if(!['instagram_business_basic','instagram_business_manage_messages'].every(scope=>scopes.includes(scope)))throw new HttpError(403,'META_PERMISSIONS_REQUIRED');
 // Meta specifies query credentials here; never log this server-only request URL.
 const url=new URL('https://graph.instagram.com/access_token');
 url.searchParams.set('grant_type','ig_exchange_token');url.searchParams.set('client_secret',config.appSecret);url.searchParams.set('access_token',entry.access_token);
 const long=await metaJsonRequest(url,{method:'GET'},request);
 if(!validToken(long.access_token)||typeof long.token_type!=='string'||long.token_type.toLowerCase()!=='bearer'
  ||typeof long.expires_in!=='number'||!Number.isSafeInteger(long.expires_in)||long.expires_in<=0)throw new HttpError(502,'META_RESPONSE_INVALID');
 return {token:long.access_token,userId:entry.user_id,expiresIn:long.expires_in,scopes};
}
