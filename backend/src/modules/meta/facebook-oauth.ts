import {createHmac} from 'node:crypto';
import {HttpError} from '../../core/security';
import type {MetaConfig} from './config';
import {metaJsonRequest,type MetaFetch} from './http';

export interface FacebookGrant {token:string;expiresIn:number|null;scopes:string[]}
/** Server-only exchange. Caller must commit OAuth state consumption before invoking this function. */
export async function exchangeFacebookCode(config:MetaConfig,code:string,request?:MetaFetch):Promise<FacebookGrant> {
 if(config.provider!=='facebook')throw new HttpError(400,'META_PROVIDER_INVALID');
 if(!code || code.length>8192 || /[\r\n]/.test(code))throw new HttpError(400,'META_CODE_INVALID');
 const body=new URLSearchParams({client_id:config.appId,client_secret:config.appSecret,redirect_uri:config.redirectUri,code});
 const data=await metaJsonRequest(new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`),{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body
 },request);
 if(typeof data.access_token!=='string' || !data.access_token || data.access_token.length>16384 || /[\r\n]/.test(data.access_token))throw new HttpError(502,'META_RESPONSE_INVALID');
 if(data.expires_in!==undefined && (typeof data.expires_in!=='number' || !Number.isSafeInteger(data.expires_in) || data.expires_in<=0))throw new HttpError(502,'META_RESPONSE_INVALID');
 const token=data.access_token;
 const url=new URL(`https://graph.facebook.com/${config.graphVersion}/me/permissions`);
 url.searchParams.set('appsecret_proof',createHmac('sha256',config.appSecret).update(token).digest('hex'));
 const permissions=await metaJsonRequest(url,{headers:{Authorization:`Bearer ${token}`}},request);
 if(!Array.isArray(permissions.data))throw new HttpError(502,'META_RESPONSE_INVALID');
 const scopes:string[]=[];
 for(const item of permissions.data) {
  if(!item || typeof item.permission!=='string' || typeof item.status!=='string')throw new HttpError(502,'META_RESPONSE_INVALID');
  if(item.status==='granted')scopes.push(item.permission);
 }
 for(const required of ['pages_show_list','pages_messaging','pages_manage_metadata','pages_read_engagement']) {
  if(!scopes.includes(required))throw new HttpError(403,'META_PERMISSIONS_REQUIRED');
 }
 return {token,expiresIn:typeof data.expires_in==='number'?data.expires_in:null,scopes:[...new Set(scopes)]};
}
