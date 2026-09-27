import {performance} from 'node:perf_hooks';
import {SaxesParser} from 'saxes';
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

// Streaming XML parser: reject DTDs/entities and retain only bounded direct loc entries.
function manifest(body:Buffer,contentType:string,limit:number):{index:boolean;urls:string[]} {
 if(!/^(?:application\/(?:xml|rss\+xml)|text\/xml|$)/i.test(contentType.split(';')[0].trim()))throw new HttpError(415,'SOURCE_CONTENT_UNSUPPORTED');
 const parser=new SaxesParser({xmlns:true}),stack:string[]=[],urls:string[]=[];
 let root='',loc='';
 parser.on('doctype',()=>{throw new Error('DTD forbidden');});
 parser.on('error',()=>{throw new Error('Invalid XML');});
 parser.on('opentag',tag=>{
  stack.push(tag.local);
  if(stack.length===1){root=tag.local;if(root!=='sitemapindex'&&root!=='urlset')throw new Error('Invalid root');}
  if(stack.length>64)throw new Error('XML depth');
  if(stack.length===3&&tag.local==='loc')loc='';
 });
 const append=(text:string)=>{if(stack.length===3&&stack[2]==='loc')loc+=text;};
 parser.on('text',append);parser.on('cdata',append);
 parser.on('closetag',()=>{
  if(stack.length===3&&stack[2]==='loc'&&stack[1]===(root==='sitemapindex'?'sitemap':'url')&&urls.length<limit){
   const value=loc.trim();if(value)urls.push(value);
  }
  stack.pop();
 });
 try{parser.write(body.toString('utf8')).close();}catch{throw new HttpError(422,'SOURCE_XML_INVALID');}
 if(!root||!urls.length)throw new HttpError(422,'SOURCE_CONTENT_EMPTY');
 return {index:root==='sitemapindex',urls};
}

/** Sitemap manifests and HTML leaves share one request/byte/deadline budget. */
export async function crawlSitemap(raw:string,input:Partial<FetchPolicy>={},fetcher:typeof fetchWebSource=fetchWebSource):Promise<ParsedWebDocument & {url:string;status:number}>{
 const policy=validateFetchPolicy(input),deadline=performance.now()+25000,start=canonical(raw,raw);
 if(!start)throw new HttpError(400,'INVALID_SOURCE_URL');
 const queue=[{url:start,depth:0,manifest:true}],seen=new Set([start]),fetchedUrls=new Set<string>();
 const items:ParsedWebDocument['items']=[];
 let bytes=0,requests=0,rootUrl=start,rootStatus=200;
 const remaining=()=>{const ms=Math.floor(deadline-performance.now());if(ms<100)throw new HttpError(408,'SOURCE_TIMEOUT');return ms;};
 while(queue.length&&requests<policy.maxPages){
  const next=queue.shift()!;
  if(fetchedUrls.has(next.url))continue;
  if(requests&&policy.delayMs){
   if(policy.delayMs+100>=remaining())throw new HttpError(408,'SOURCE_TIMEOUT');
   await new Promise(resolve=>setTimeout(resolve,policy.delayMs));
  }
  const budget=policy.maxBytes-bytes;
  if(budget<1)throw new HttpError(400,'RESPONSE_TOO_LARGE');
  requests++;
  const fetched=await fetcher(next.url,{...policy,maxBytes:budget,timeoutMs:Math.min(policy.timeoutMs,remaining())});
  remaining();bytes+=fetched.body.byteLength;
  if(bytes>policy.maxBytes)throw new HttpError(400,'RESPONSE_TOO_LARGE');
  const url=canonical(fetched.url,start);
  if(!url)throw new HttpError(400,'SOURCE_CROSS_ORIGIN');
  if(requests===1){rootUrl=url;rootStatus=fetched.status;}
  if(fetchedUrls.has(url))continue;
  fetchedUrls.add(url);seen.add(url);
  if(!next.manifest){
   const parsed=parseWebSource('URL',fetched.body,fetched.contentType,policy);
   items.push(...parsed.items.map(item=>({...item,url})));continue;
  }
  const parsed=manifest(fetched.body,fetched.contentType,policy.maxPages);
  if(next.depth>=policy.maxDepth)continue;
  for(const entry of parsed.urls){
   const target=canonical(entry,url);
   if(!target||seen.has(target))continue;
   if(requests+queue.length>=policy.maxPages)break;
   seen.add(target);queue.push({url:target,depth:next.depth+1,manifest:parsed.index});
  }
 }
 remaining();
 if(!items.length)throw new HttpError(422,'SOURCE_CONTENT_EMPTY');
 return {kind:'URL',items,contentType:'text/html',url:rootUrl,status:rootStatus};
}
