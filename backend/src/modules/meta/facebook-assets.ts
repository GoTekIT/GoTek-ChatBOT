import {createHmac} from 'node:crypto';
import {HttpError} from '../../core/security';
import type {MetaConfig} from './config';
import {metaJsonRequest,type MetaFetch} from './http';

/** Internal type: pageToken must never be serialized into a browser response. */
export interface FacebookPageAsset {id:string; name:string; pageToken:string; tasks:string[]}
export interface FacebookPageBatch {assets:FacebookPageAsset[]; after?:string}

/** Fetch a single bounded page. Persist encrypted candidates before returning a safe projection to the UI. */
export async function discoverFacebookPages(config:MetaConfig,userToken:string,after?:string,request?:MetaFetch):Promise<FacebookPageBatch> {
 if(config.provider!=='facebook') throw new HttpError(400,'META_PROVIDER_INVALID');
 if(!userToken || userToken.length>16384 || /[\r\n]/.test(userToken)) throw new HttpError(400,'META_TOKEN_INVALID');
 if(after!==undefined && (!after || after.length>4096)) throw new HttpError(400,'META_CURSOR_INVALID');
 const url=new URL(`https://graph.facebook.com/${config.graphVersion}/me/accounts`);
 url.searchParams.set('fields','id,name,access_token,tasks');
 url.searchParams.set('limit','100');
 url.searchParams.set('appsecret_proof',createHmac('sha256',config.appSecret).update(userToken).digest('hex'));
 if(after)url.searchParams.set('after',after);
 const result=await metaJsonRequest(url,{headers:{Authorization:`Bearer ${userToken}`}},request);
 if(!Array.isArray(result.data) || result.data.length>100)throw new HttpError(502,'META_RESPONSE_INVALID');
 const assets:FacebookPageAsset[]=[];
 const seen=new Set<string>();
 for(const item of result.data) {
  if(!item || typeof item!=='object' || typeof item.id!=='string' || !/^\d+$/.test(item.id)
   || typeof item.name!=='string' || item.name.length>1024 || !Array.isArray(item.tasks)
   || !item.tasks.every((task:unknown)=>typeof task==='string'))throw new HttpError(502,'META_RESPONSE_INVALID');
  // Asset discovery is not proof of approved permissions; connect must validate granted scopes too.
  if(!item.tasks.includes('MESSAGING') && !item.tasks.includes('MANAGE'))continue;
  if(typeof item.access_token!=='string' || !item.access_token || item.access_token.length>16384 || /[\r\n]/.test(item.access_token))throw new HttpError(502,'META_RESPONSE_INVALID');
  if(seen.has(item.id))continue;
  seen.add(item.id);
  assets.push({id:item.id,name:item.name,pageToken:item.access_token,tasks:item.tasks});
 }
 let cursor:string|undefined;
 if(result.paging!==undefined) {
  const paging=result.paging as {next?:unknown;cursors?:{after?:unknown}};
  if(!paging || typeof paging!=='object')throw new HttpError(502,'META_RESPONSE_INVALID');
  if(paging.next) {
   const value=paging.cursors?.after;
   if(typeof value!=='string' || !value || value.length>4096 || value===after)throw new HttpError(502,'META_RESPONSE_INVALID');
   cursor=value;
  }
 }
 // Never return/follow paging.next: it can embed a token or an unexpected origin.
 return {assets,after:cursor};
}

export function publicFacebookAssets(assets:FacebookPageAsset[]) {
 return assets.map(({id,name})=>({id,name}));
}
