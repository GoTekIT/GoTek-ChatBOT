import {createApp} from './app';
import express from 'express';
import {resolve} from 'node:path';
const app=createApp();
if(process.env.NODE_ENV==='production'){throw new Error('Production is not approved. Use local/test environment.');}
if(process.env.SERVE_BUILD==='true'){app.use(express.static(resolve('dist')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(4317,'127.0.0.1',()=>console.log('GoTek local/test: http://127.0.0.1:4317'));
