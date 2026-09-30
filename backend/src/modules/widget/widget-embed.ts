import type {Request,Response} from 'express';
/** Compatibility entry point; channel installation and this loader share one SDK. */
export function widgetEmbed(_req:Request,res:Response){
 res.type('application/javascript').set('Cache-Control','no-store').set('Cross-Origin-Resource-Policy','cross-origin').send(`(()=>{const source=document.currentScript;const key=source&&source.dataset.key;if(!key||! /^[A-Za-z0-9_-]{40,80}$/.test(key))return;const base=new URL(source.src).origin;const run=()=>window.gotekSDK.run({websiteToken:key,baseUrl:base});if(window.gotekSDK){run();return;}const loader=document.createElement('script');loader.src=base+'/sdk.js';loader.onload=run;document.head.append(loader);})();`);
}
