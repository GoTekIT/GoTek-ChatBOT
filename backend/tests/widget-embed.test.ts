import test from 'node:test';import assert from 'node:assert/strict';import {runInNewContext} from 'node:vm';import {widgetEmbed} from '../src/modules/widget/widget-embed';
test('widget compatibility loader uses the canonical channel SDK and preserves key',()=>{
 let code='';const headers:Record<string,string>={};const res:any={type(){return this;},set(k:string,v:string){headers[k]=v;return this;},send(s:string){code=s;}};widgetEmbed({} as any,res);
 assert.equal(headers['Cross-Origin-Resource-Policy'],'cross-origin');
 const key='a'.repeat(43),scripts:any[]=[],calls:any[]=[],window:any={};
 const context={URL,window,document:{currentScript:{src:'https://widget.test/widget.js',dataset:{key}},createElement:()=>({}),head:{append(s:any){scripts.push(s);}}}};
 runInNewContext(code,context);assert.equal(scripts.length,1);assert.equal(scripts[0].src,'https://widget.test/sdk.js');
 window.gotekSDK={run:(config:any)=>calls.push(config)};scripts[0].onload();assert.equal(calls[0].websiteToken,key);assert.equal(calls[0].baseUrl,'https://widget.test');
 runInNewContext(code,context);assert.equal(scripts.length,1);assert.equal(calls.length,2);
});
