import {SaxesParser} from 'saxes';
import {HttpError} from '../../core/security';
import {assertBodyBytes, validateFetchPolicy, type FetchPolicy} from './web-source-policy';

export type ParsedWebItem={title:string;url?:string;text?:string};
export type ParsedWebDocument={kind:'URL'|'RSS'|'SITEMAP';items:ParsedWebItem[];contentType:string};

function decodeEntities(value:string):string {
 return value.replace(/&(#(?:x[\da-fA-F]+|\d+)|amp|lt|gt|quot|apos|nbsp);/g,(_,entity:string)=>{
  if(entity==='amp') return '&'; if(entity==='lt') return '<'; if(entity==='gt') return '>'; if(entity==='quot') return '"'; if(entity==='apos') return "'"; if(entity==='nbsp') return ' ';
  const n=entity.slice(0,2).toLowerCase()==='#x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
  return Number.isFinite(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';
 });
}
function cleanText(value:string):string { return decodeEntities(value.replace(/<!--[\s\S]*?-->/g,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim(); }
type XmlNode={name:string;text:string;attributes:Record<string,string>;children:XmlNode[]};
function parseXml(xml:string):XmlNode {
 const parser=new SaxesParser({xmlns:true}); const stack:XmlNode[]=[]; let root:XmlNode|undefined;
 parser.on('doctype',()=>{throw new HttpError(422,'SOURCE_XML_INVALID');});
 parser.on('error',()=>{throw new HttpError(422,'SOURCE_XML_INVALID');});
 parser.on('opentag',tag=>{
  const node:XmlNode={name:tag.local,text:'',attributes:{},children:[]};
  for(const attr of Object.values(tag.attributes)) node.attributes[attr.local]=attr.value;
  const parent=stack.at(-1); if(parent) parent.children.push(node); else root=node;
  stack.push(node);
 });
 const append=(value:string)=>{const node=stack.at(-1);if(node) node.text+=value;};
 parser.on('text',append); parser.on('cdata',append);
 parser.on('closetag',()=>{const node=stack.pop(); const parent=stack.at(-1); if(node&&parent) parent.text+=node.text;});
 try {parser.write(xml).close();} catch {throw new HttpError(422,'SOURCE_XML_INVALID');}
 if(!root) throw new HttpError(422,'SOURCE_XML_INVALID'); return root;
}
const children=(node:XmlNode,name:string)=>node.children.filter(child=>child.name===name);
const xmlText=(node:XmlNode,name:string)=>children(node,name)[0]?.text.trim()??'';
function safeLink(value:string):string|undefined {
 if(!value) return undefined;
 try {const url=new URL(value); return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:undefined;} catch {return undefined;}
}
function limit(items:ParsedWebItem[],policy:FetchPolicy){return items.slice(0,policy.maxPages);}
export function parseWebSourceResponse(kind:'URL'|'RSS'|'SITEMAP', body:Buffer|string, contentType='text/html', input:Partial<FetchPolicy>={}):ParsedWebDocument {
 const policy=validateFetchPolicy(input); const raw=typeof body==='string'?Buffer.from(body):body; assertBodyBytes(raw.byteLength,policy); const text=raw.toString('utf8');
 if(kind==='URL'){ if(!/^\s*(?:text\/html|application\/xhtml\+xml|$)/i.test(contentType.split(';')[0])) throw new HttpError(415,'SOURCE_CONTENT_UNSUPPORTED'); const cleaned=cleanText(text); if(!cleaned) throw new HttpError(422,'SOURCE_CONTENT_EMPTY'); return {kind,items:limit([{title:cleaned,text:cleaned}],policy),contentType}; }
 if(!/^(?:application\/(?:xml|rss\+xml)|text\/xml|application\/atom\+xml|$)/i.test(contentType.split(';')[0])) throw new HttpError(415,'SOURCE_CONTENT_UNSUPPORTED');
 const root=parseXml(text);
 if(kind==='SITEMAP') {
  if(!['urlset','sitemapindex'].includes(root.name)) throw new HttpError(422,'SOURCE_XML_INVALID');
  const items=children(root,root.name==='urlset'?'url':'sitemap').flatMap(node=>{const url=safeLink(xmlText(node,'loc'));return url?[{title:url,url}]:[];});
  if(!items.length) throw new HttpError(422,'SOURCE_CONTENT_EMPTY'); return {kind,items:limit(items,policy),contentType};
 }
 if(!['rss','feed'].includes(root.name)) throw new HttpError(422,'SOURCE_XML_INVALID');
 const nodes=root.name==='feed'?children(root,'entry'):children(root,'channel').flatMap(channel=>children(channel,'item'));
 const items=nodes.flatMap(node=>{
  const title=cleanText(xmlText(node,'title'));
  const link=children(node,'link').find(link=>!link.attributes.rel||link.attributes.rel==='alternate');
  const url=safeLink((link?.attributes.href||link?.text||'').trim());
  const description=xmlText(node,root.name==='feed'?'summary':'description');
  return title||url?[{title:title||url||'',url:url||undefined,...(description?{text:cleanText(description)}:{})}]:[];
 });
 if(!items.length) throw new HttpError(422,'SOURCE_CONTENT_EMPTY'); return {kind,items:limit(items,policy),contentType};
}
export const parseWebSource=parseWebSourceResponse;
