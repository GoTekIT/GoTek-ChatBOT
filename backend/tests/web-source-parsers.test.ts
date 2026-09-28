import test from 'node:test'; import assert from 'node:assert/strict'; import {parseWebSourceResponse} from '../src/modules/web-sources/web-source-parsers';
const p={maxPages:2};
test('URL strips executable markup and decodes entities',()=>{const d=parseWebSourceResponse('URL',Buffer.from('<html><script>x</script><h1>GoTek &amp; Hi</h1><style>x</style><p>Knowledge</p></html>'),'text/html',p);assert.equal(d.items[0].title,'GoTek & Hi Knowledge');});
test('RSS extracts title/link and limits items',()=>{const x='<rss><channel><item><title>One &amp; A</title><link>https://a.test/</link></item><item><title>Two</title><link>https://b.test/</link></item><item><title>Three</title><link>https://c.test/</link></item></channel></rss>';const d=parseWebSourceResponse('RSS',x,'application/rss+xml',p);assert.equal(d.items.length,2);assert.equal(d.items[0].url,'https://a.test/');});
test('sitemap extracts loc URLs',()=>{const d=parseWebSourceResponse('SITEMAP','<urlset><url><loc>https://a.test/</loc></url><url><loc>https://b.test/</loc></url></urlset>','application/xml',{maxPages:1});assert.deepEqual(d.items.map(i=>i.url),['https://a.test/']);});
test('rejects malformed, unsupported and empty documents',()=>{assert.throws(()=>parseWebSourceResponse('RSS','<rss><item></rss>','application/rss+xml'),(e:any)=>e.code==='SOURCE_XML_INVALID');assert.throws(()=>parseWebSourceResponse('SITEMAP','<html>x</html>','text/html'),(e:any)=>e.code==='SOURCE_CONTENT_UNSUPPORTED');assert.throws(()=>parseWebSourceResponse('URL','<script>x</script>','text/html'),(e:any)=>e.code==='SOURCE_CONTENT_EMPTY');});
test('XML declaration and RSS CDATA produce readable content',()=>{
 const doc=parseWebSourceResponse('RSS','<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title><![CDATA[GoTek <b>News</b>]]></title><link>https://example.com/?a=1&amp;b=2</link><description><![CDATA[<p>Xin chào &amp; cảm ơn</p>]]></description></item></channel></rss>','application/rss+xml');
 assert.deepEqual(doc.items,[{title:'GoTek News',url:'https://example.com/?a=1&b=2',text:'Xin chào & cảm ơn'}]);
});
test('hexadecimal numeric entities decode without losing Unicode',()=>{
 assert.equal(parseWebSourceResponse('URL','<p>&#x1F600; &#65; &#x1EC7;</p>').items[0].text,'😀 A ệ');
 assert.equal(parseWebSourceResponse('RSS','<rss><channel><item><title>&#x1F600;</title></item></channel></rss>','application/xml').items[0].title,'😀');
});
test('strict XML rejects multiple roots, trailing text, invalid entities/attributes and DTD',()=>{
 const invalid=['<rss/><rss/>','<rss/>garbage','<rss><channel>&unknown;</channel></rss>','<rss version=2/>','<rss a="1" a="2"/>','<!DOCTYPE rss [<!ENTITY x "boom">]><rss/>','<rss><channel><![CDATA[unfinished</channel></rss>'];
 for(const xml of invalid) assert.throws(()=>parseWebSourceResponse('RSS',xml,'application/xml'),(e:any)=>e.code==='SOURCE_XML_INVALID',xml);
});
test('Atom namespace entries and alternate links are parsed',()=>{
 const doc=parseWebSourceResponse('RSS','<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>GoTek</title><link rel="self" href="https://example.com/api"/><link rel="alternate" href="https://example.com/news"/><summary>Hello</summary></entry></feed>','application/atom+xml');
 assert.deepEqual(doc.items,[{title:'GoTek',url:'https://example.com/news',text:'Hello'}]);
});
test('unsafe parsed links are not returned to the UI',()=>{
 const doc=parseWebSourceResponse('RSS','<rss><channel><item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>','application/xml');
 assert.equal(doc.items[0].url,undefined);
 assert.throws(()=>parseWebSourceResponse('SITEMAP','<urlset><url><loc>file:///etc/passwd</loc></url></urlset>','application/xml'),(e:any)=>e.code==='SOURCE_CONTENT_EMPTY');
});
