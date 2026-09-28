import http from 'node:http';
import https from 'node:https';
import {isIP} from 'node:net';
import {HttpError} from '../../core/security';
import {defaultResolveHost,resolveWebSourceTarget,validateRedirectTarget,type ResolveHost} from './web-source-security';
import {assertBodyBytes,assertRedirectBudget,validateFetchPolicy,type FetchPolicy} from './web-source-policy';

export type WebFetchResult={url:string;status:number;contentType:string;body:Buffer};
// No pooled sockets: each hop connects only to an address checked for this request.
// The URL hostname is retained for Host, TLS SNI and certificate validation.
export async function fetchWebSource(raw:string,input:Partial<FetchPolicy>={},resolve:ResolveHost=defaultResolveHost):Promise<WebFetchResult>{
 const policy=validateFetchPolicy(input),controller=new AbortController();
 const timeout=new HttpError(408,'SOURCE_TIMEOUT');
 const timer=setTimeout(()=>controller.abort(timeout),policy.timeoutMs);
 const aborted=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(timeout),{once:true}));
 async function run(){
  let url=raw,original='',redirects=0;
  for(;;){
   const target=await resolveWebSourceTarget(url,resolve);
   if(controller.signal.aborted)throw timeout;
   if(!original)original=target.url;
   const u=new URL(target.url),address=target.addresses[0];
   const response=await new Promise<{status:number;location?:string;contentType:string;body:Buffer}>((resolveResponse,reject)=>{
    const request=(u.protocol==='https:'?https:http).request(u,{
     method:'GET',agent:false,signal:controller.signal,
     headers:{Accept:'text/html,application/xhtml+xml,application/xml,text/xml,application/rss+xml','Accept-Encoding':'identity','User-Agent':'GoTekKnowledgeBot/1.0'},
     lookup:((_host:any,options:any,callback:any)=>options?.all?callback(null,[{address,family:isIP(address)}]):callback(null,address,isIP(address))) as any
    },response=>{
     const status=response.statusCode??0;
     if([301,302,303,307,308].includes(status)){
      const location=response.headers.location;response.destroy();
      resolveResponse({status,location,contentType:'',body:Buffer.alloc(0)});return;
     }
     if(status<200||status>=300){response.destroy();reject(new HttpError(502,'SOURCE_HTTP_ERROR'));return;}
     if(response.headers['content-encoding']&&response.headers['content-encoding']!=='identity'){
      response.destroy();reject(new HttpError(502,'SOURCE_ENCODING_UNSUPPORTED'));return;
     }
     const chunks:Buffer[]=[];let bytes=0;
     response.on('error',reject);
     response.on('data',(chunk:Buffer)=>{
      bytes+=chunk.length;
      try{assertBodyBytes(bytes,policy);chunks.push(chunk);}catch(error){response.destroy();reject(error);}
     });
     response.on('end',()=>resolveResponse({status,contentType:response.headers['content-type']??'',body:Buffer.concat(chunks)}));
    });
    request.on('error',error=>reject(controller.signal.aborted?timeout:new HttpError(502,'SOURCE_FETCH_FAILED')));
    request.end();
   });
   if([301,302,303,307,308].includes(response.status)){
    assertRedirectBudget(++redirects,policy);
    if(!response.location)throw new HttpError(502,'SOURCE_REDIRECT_INVALID');
    // Resolve relative Location against the current hop, while retaining initial origin.
    const next=new URL(response.location,target.url).href;
    url=await validateRedirectTarget(next,original,resolve);continue;
   }
   return {url:target.url,status:response.status,contentType:response.contentType,body:response.body};
  }
 }
 try{return await Promise.race([run(),aborted]);}finally{clearTimeout(timer);}
}
