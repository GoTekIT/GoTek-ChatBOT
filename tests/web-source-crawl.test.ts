import test from 'node:test';
import assert from 'node:assert/strict';
import {crawlWebSource} from '../src/server/web-source-crawl';
test('crawl follows bounded same-origin links, deduplicates fragments and retains page provenance',async()=>{
 const seen:string[]=[];
 const pages:Record<string,string>={
  'https://example.com/':'<p>Root</p><a href="/a#first">A</a><a href="/a#second">A again</a><a href="https://other.test/">outside</a><a href="/b">B</a>',
  'https://example.com/a':'<p>Page A</p><a href="/deep">Deep</a>',
  'https://example.com/b':'<p>Page B</p>',
 };
 const result=await crawlWebSource('https://example.com/',{maxPages:3,maxDepth:1},async url=>{seen.push(url);assert.ok(pages[url]);return {url,status:200,contentType:'text/html',body:Buffer.from(pages[url])};});
 assert.deepEqual(seen,['https://example.com/','https://example.com/a','https://example.com/b']);
 assert.deepEqual(result.items.map(i=>i.url),seen);assert.ok(result.items[1].text?.includes('Page A'));
});
test('crawl rejects aggregate byte overflow rather than persisting partial success',async()=>{
 let calls=0;
 await assert.rejects(crawlWebSource('https://example.com/',{maxBytes:80},async url=>{calls++;return {url,status:200,contentType:'text/html',body:Buffer.from(calls===1?'<p>Root</p><a href="/a">next</a>':'<p>'+ 'x'.repeat(60)+'</p>')};}));
 assert.equal(calls,2);
});
