import {performance} from 'node:perf_hooks';
import {HttpError} from './security';
import {fetchWebSource} from './web-source-fetch';
import {parseWebSource,type ParsedWebDocument} from './web-source-parsers';
import {validateFetchPolicy,type FetchPolicy} from './web-source-policy';

function canonical(raw:string,base:string):string|undefined {
 try {
  const url=new URL(raw,base);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.origin!==new URL(base).origin)return;
  url.hash='';return url.href;
 }catch{return;}
}
// Conservative static HTML anchors only; no JavaScript execution or <base> overrides.
function links(html:string,base:string,limit:number):string[]{
 const result:string[]=[];
 const stripped=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const anchors=/<a\b[^>]*\s+href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
 for(const match of stripped.matchAll(anchors)){
  const raw=(match[1]??match[2]??match[3]).replace(/&amp;/gi,'&').replace(/&#(x[\da-f]+|\d+);/gi,(_,n:string)=>{
   const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);
   return code<=0x10ffff?String.fromCodePoint(code):'';
  });
  const url=canonical(raw,base);
  if(url&&!result.includes(url))result.push(url);
  if(result.length>=limit)break;
 }
 return result;
}

/** Bounded breadth-first crawl; a failed page fails the refresh, never publishes partial data. */
export async function crawlWebSource(raw:string,input:Partial<FetchPolicy>={},fetcher:typeof fetchWebSource=fetchWebSource):Promise<ParsedWebDocument & {url:string;status:number}>{
 const policy=validateFetchPolicy(input),deadline=performance.now()+25000;
 const start=canonical(raw,raw);
 if(!start)throw new HttpError(400,'INVALID_SOURCE_URL');
 const queue=[{url:start,depth:0}],seen=new Set([start]);
 const items:ParsedWebDocument['items']=[];
 let bytes=0,rootUrl=start,rootStatus=200,contentType='text/html';
 const remaining=()=>{const ms=Math.floor(deadline-performance.now());if(ms<100)throw new HttpError(408,'SOURCE_TIMEOUT');return ms;};
 while(queue.length&&items.length<policy.maxPages){
  const next=queue.shift()!;
  if(items.length&&policy.delayMs){
   if(policy.delayMs+100>=remaining())throw new HttpError(408,'SOURCE_TIMEOUT');
   await new Promise(resolve=>setTimeout(resolve,policy.delayMs));
  }
  const budget=policy.maxBytes-bytes;
  if(budget<1)throw new HttpError(400,'RESPONSE_TOO_LARGE');
  const fetched=await fetcher(next.url,{...policy,maxBytes:budget,timeoutMs:Math.min(policy.timeoutMs,remaining())});
  remaining();
  const fetchedUrl=canonical(fetched.url,start);
  if(!fetchedUrl)throw new HttpError(400,'SOURCE_CROSS_ORIGIN');
  bytes+=fetched.body.byteLength;
  if(bytes>policy.maxBytes)throw new HttpError(400,'RESPONSE_TOO_LARGE');
  // Redirect aliases can converge on a page already represented in this snapshot.
  if(items.some(item=>item.url===fetchedUrl))continue;
  const parsed=parseWebSource('URL',fetched.body,fetched.contentType,policy);
  if(!items.length){rootUrl=fetchedUrl;rootStatus=fetched.status;contentType=fetched.contentType;}
  items.push(...parsed.items.map(item=>({...item,url:fetchedUrl})));
  seen.add(fetchedUrl);
  if(next.depth<policy.maxDepth){
   // Queue is bounded as well as the fetched page count.
   for(const url of links(fetched.body.toString('utf8'),fetchedUrl,policy.maxPages*2)){
    if(seen.has(url))continue;
    if(items.length+queue.length>=policy.maxPages)break;
    seen.add(url);queue.push({url,depth:next.depth+1});
   }
  }
 }
 remaining();
 return {kind:'URL',items,contentType,url:rootUrl,status:rootStatus};
}
