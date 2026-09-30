import test from 'node:test';import assert from 'node:assert/strict';import {validateRedirectTarget,validateWebSourceUrl} from '../src/modules/web-sources/web-source-security';
const safe=async(host:string)=>host==='example.com'?['93.184.216.34']:[];
test('H11 rejects unsafe source URLs and DNS-resolved private addresses',async()=>{for(const u of ['javascript:alert(1)','https://user:pass@example.com/a#x','http://127.0.0.1/x','https://metadata.google.internal/'])await assert.rejects(()=>validateWebSourceUrl(u,safe));await assert.rejects(()=>validateWebSourceUrl('https://evil.example/x',async()=>['10.0.0.9']));assert.equal(await validateWebSourceUrl('https://example.com/path?q=1',safe),'https://example.com/path?q=1');});
test('H11 redirects preserve origin and revalidate DNS',async()=>{
 const original='https://example.com/start/page';
 assert.equal(await validateRedirectTarget('../next?q=1',original,safe),'https://example.com/next?q=1');
 assert.equal(await validateRedirectTarget('https://EXAMPLE.com:443/next',original,safe),'https://example.com/next');
 for(const target of ['http://example.com/next','https://example.com:8080/next','https://other.example/next','//other.example/next']){
  await assert.rejects(validateRedirectTarget(target,original,async()=>['8.8.8.8']),(e:any)=>e.code==='REDIRECT_ORIGIN_BLOCKED');
 }
 await assert.rejects(validateRedirectTarget('/next',original,async()=>['127.0.0.1']),(e:any)=>e.code==='SSRF_BLOCKED');
 await assert.rejects(validateRedirectTarget('/next','example.com',safe),(e:any)=>e.code==='INVALID_SOURCE_URL');
 await assert.rejects(validateRedirectTarget('https://user:pass@example.com/next',original,safe),(e:any)=>e.code==='INVALID_SOURCE_URL');
});

test('H11 rejects literal and resolved special ranges without fail-open',async()=>{
 for(const address of ['::ffff:127.0.0.1','::','fe90::1','0.0.0.0','100.64.0.1','224.0.0.1','not-an-ip','2001:db8::1']){
  await assert.rejects(validateWebSourceUrl('https://example.com/',async()=>[address]),(e:any)=>e.code==='SSRF_BLOCKED');
 }
 await assert.rejects(validateWebSourceUrl('http://127.0.0.1/',async()=>['8.8.8.8']),(e:any)=>e.code==='SSRF_BLOCKED');
 await assert.rejects(validateWebSourceUrl('https://example.com/',async()=>['8.8.8.8','10.0.0.1']),(e:any)=>e.code==='SSRF_BLOCKED');
 assert.equal(await validateWebSourceUrl('https://example.com/',async()=>['2606:4700::1111']),'https://example.com/');
});
