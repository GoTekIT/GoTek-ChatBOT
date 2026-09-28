import test from 'node:test';
import assert from 'node:assert/strict';
import {crawlSitemap} from '../src/modules/web-sources/web-sitemap-crawl';
test('sitemap index crawls bounded same-origin page content with provenance',async()=>{
 const docs:Record<string,string>={
 'https://example.com/index.xml':'<sitemapindex><sitemap><loc>https://example.com/map.xml</loc></sitemap></sitemapindex>',
 'https://example.com/map.xml':'<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://outside.test/b</loc></url><url><loc>https://example.com/a</loc></url></urlset>',
 'https://example.com/a':'<h1>Business knowledge</h1>'};
 const seen:string[]=[];
 const result=await crawlSitemap('https://example.com/index.xml',{maxPages:4,maxDepth:2},async url=>{seen.push(url);return {url,status:200,body:Buffer.from(docs[url]),contentType:url.endsWith('.xml')?'application/xml':'text/html'};});
 assert.deepEqual(seen,Object.keys(docs));assert.equal(result.kind,'URL');
 assert.equal(result.items.length,1);assert.equal(result.items[0].url,'https://example.com/a');assert.equal(result.items[0].text,'Business knowledge');
});
