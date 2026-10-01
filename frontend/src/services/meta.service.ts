import {api} from '../api/api';
export type MetaProvider='facebook'|'instagram';
export interface MetaConnection {
 id:string;channel_id:string;provider:MetaProvider;asset_id:string;asset_name:string;
 status:'pending'|'active'|'reauth_required'|'disconnected';token_expires_at:string|null;generation:number;
}
/** OAuth navigation is constrained even if the API response is malformed. Never accept a caller's callback. */
export function validateMetaAuthorizationUrl(value:unknown,provider:MetaProvider):string {
 if(typeof value!=='string')throw new Error('Địa chỉ kết nối Meta không hợp lệ.');
 let url:URL;
 try{url=new URL(value);}catch{throw new Error('Địa chỉ kết nối Meta không hợp lệ.');}
 const validPath=provider==='facebook'?/^\/v\d+\.\d+\/dialog\/oauth$/.test(url.pathname):url.pathname==='/oauth/authorize';
 if(url.protocol!=='https:'||url.hostname!==(provider==='facebook'?'www.facebook.com':'www.instagram.com')||url.port||url.username||url.password||url.hash||!validPath
  ||!/^\d+$/.test(url.searchParams.get('client_id')||'')||!/^[a-f0-9]{64}$/.test(url.searchParams.get('state')||'')||url.searchParams.get('response_type')!=='code')
  throw new Error('Địa chỉ kết nối Meta không hợp lệ.');
 return url.href;
}
const base='/integrations/meta';
export const MetaService={
 list:():Promise<MetaConnection[]>=>api(base+'/connections'),
 async connect(provider:MetaProvider):Promise<string>{
  const result=await api(`${base}/${provider}/connect`,'POST');
  return validateMetaAuthorizationUrl(result.authorizationUrl,provider);
 },
 pages:(enrollmentId:string,after?:string):Promise<{assets:Array<{id:string;name:string}>;after:string|null}>=>
  api(`${base}/facebook/enrollments/${encodeURIComponent(enrollmentId)}/pages${after?'?after='+encodeURIComponent(after):''}`),
 selectPage:(enrollmentId:string,assetId:string,after?:string)=>api(`${base}/facebook/enrollments/${encodeURIComponent(enrollmentId)}/select`,'POST',{assetId,...(after?{after}:{})}),
 activate:(provider:MetaProvider,id:string)=>api(`${base}/${provider}/connections/${encodeURIComponent(id)}/activate`,'POST'),
 disconnect:(id:string)=>api(`${base}/connections/${encodeURIComponent(id)}/disconnect`,'POST')
};
