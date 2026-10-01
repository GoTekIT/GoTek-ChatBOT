import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {listMetaConnections,disconnectMetaConnection} from '../modules/meta/connections';
import {reconcileExpiredMetaReplies} from '../modules/meta/outbox';

export const metaRouter = Router();
metaRouter.get('/integrations/meta/connections',authed(
 (db,actor)=>listMetaConnections(db,actor),'channels.manage'
));
// This endpoint disconnects GoTek processing; it does not claim to revoke Meta permissions.
metaRouter.post('/integrations/meta/connections/:id/disconnect',authed(
 (db,actor,req)=>disconnectMetaConnection(db,actor,String(req.params.id)),'channels.manage'
));

// Move abandoned dispatch claims to reviewable state. This never retries provider sends.
metaRouter.post('/integrations/meta/outbox/reconcile',authed(async(db,actor)=>
 reconcileExpiredMetaReplies(db,actor.workspace_id),'channels.manage'
));

import {identity} from '../middlewares/auth.middleware';
import {transaction} from '../core/db';
import {HttpError} from '../core/security';
import {requirePermission} from '../core/authorization';
import {metaConfig,metaAuthorizationUrl} from '../modules/meta/config';
import {createMetaOAuthState,consumeMetaOAuthState} from '../modules/meta/oauth-state';
import {exchangeFacebookCode} from '../modules/meta/facebook-oauth';
import {metaEncryptionKey,saveFacebookEnrollment,readFacebookEnrollment} from '../modules/meta/enrollment';
import {discoverFacebookPages,publicFacebookAssets} from '../modules/meta/facebook-assets';

metaRouter.post('/integrations/meta/facebook/connect',authed(async(db,actor)=>{
 const config=metaConfig('facebook');
 metaEncryptionKey();
 const state=await createMetaOAuthState(db,actor,'facebook');
 return {authorizationUrl:metaAuthorizationUrl(config,state)};
},'channels.manage'));

metaRouter.get('/integrations/meta/facebook/callback',async(req,res)=>{
 const config=metaConfig('facebook');
 const key=metaEncryptionKey();
 const state=typeof req.query.state==='string'?req.query.state:'';
 // Commit consumption even if provider denial/exchange subsequently fails.
 const original=await transaction(async db=>{
  const actor=await identity(db,req);
  await consumeMetaOAuthState(db,actor,'facebook',state);
  return actor;
 });
 if(req.query.error!==undefined)throw new HttpError(400,'META_AUTHORIZATION_DENIED');
 const code=typeof req.query.code==='string'?req.query.code:'';
 const grant=await exchangeFacebookCode(config,code);
 const enrollmentId=await transaction(async db=>{
  const actor=await identity(db,req);
  requirePermission(actor.role,'channels.manage');
  if(actor.user_id!==original.user_id || actor.workspace_id!==original.workspace_id || actor.token_hash!==original.token_hash)
   throw new HttpError(403,'META_IDENTITY_CHANGED');
  return saveFacebookEnrollment(db,actor,grant,key);
 });
 // Temporary API response until Connect UI is integrated. No provider token leaves the server.
 res.set('Referrer-Policy','no-referrer');
 if(req.get('accept')?.includes('text/html')){res.redirect(303,'/app/channels?meta_enrollment='+encodeURIComponent(enrollmentId));return;}
 res.json({enrollmentId,next:'select_page'});
});

metaRouter.get('/integrations/meta/facebook/enrollments/:id/pages',async(req,res)=>{
 const config=metaConfig('facebook');
 const key=metaEncryptionKey();
 const id=String(req.params.id);
 if(req.query.after!==undefined && typeof req.query.after!=='string')throw new HttpError(400,'META_CURSOR_INVALID');
 const original=await transaction(async db=>{
  const actor=await identity(db,req);
  return {actor,grant:await readFacebookEnrollment(db,actor,id,key)};
 });
 const batch=await discoverFacebookPages(config,original.grant.token,req.query.after as string|undefined);
 await transaction(async db=>{
  const actor=await identity(db,req);
  if(actor.user_id!==original.actor.user_id || actor.workspace_id!==original.actor.workspace_id || actor.token_hash!==original.actor.token_hash)
   throw new HttpError(403,'META_IDENTITY_CHANGED');
  await readFacebookEnrollment(db,actor,id,key);
 });
 res.json({assets:publicFacebookAssets(batch.assets),after:batch.after});
});

import {persistFacebookPage} from '../modules/meta/select-page';
import {z} from 'zod';
metaRouter.post('/integrations/meta/facebook/enrollments/:id/select',async(req,res)=>{
 const input=z.object({assetId:z.string().regex(/^\d+$/).max(100),after:z.string().min(1).max(4096).optional()}).strict().parse(req.body);
 const id=String(req.params.id),config=metaConfig('facebook'),key=metaEncryptionKey();
 const original=await transaction(async db=>{
  const actor=await identity(db,req);
  return {actor,grant:await readFacebookEnrollment(db,actor,id,key)};
 });
 const batch=await discoverFacebookPages(config,original.grant.token,input.after);
 const asset=batch.assets.find(candidate=>candidate.id===input.assetId);
 if(!asset)throw new HttpError(403,'META_ASSET_NOT_AUTHORIZED');
 try {
  const result=await transaction(async db=>{
   const actor=await identity(db,req);
   if(actor.user_id!==original.actor.user_id || actor.workspace_id!==original.actor.workspace_id || actor.token_hash!==original.actor.token_hash)
    throw new HttpError(403,'META_IDENTITY_CHANGED');
   return persistFacebookPage(db,actor,id,asset,key);
  });
  res.status(201).json(result);
 } catch(error) {
  if((error as {code?:string}).code==='23505')throw new HttpError(409,'META_ASSET_UNAVAILABLE');
  throw error;
 }
});

import {activateFacebookConnection,activateInstagramConnection} from '../modules/meta/subscription';
metaRouter.post('/integrations/meta/facebook/connections/:id/activate',async(req,res)=>{
 res.json(await activateFacebookConnection(req,String(req.params.id)));
});

import {exchangeInstagramCode} from '../modules/meta/instagram-oauth';
import {discoverInstagramAccount} from '../modules/meta/instagram-account';
import {persistInstagramConnection} from '../modules/meta/instagram-connection';
metaRouter.post('/integrations/meta/instagram/connect',authed(async(db,actor)=>{
 const config=metaConfig('instagram');metaEncryptionKey();
 const state=await createMetaOAuthState(db,actor,'instagram');
 return {authorizationUrl:metaAuthorizationUrl(config,state)};
},'channels.manage'));
metaRouter.get('/integrations/meta/instagram/callback',async(req,res)=>{
 const config=metaConfig('instagram'),key=metaEncryptionKey();
 const state=typeof req.query.state==='string'?req.query.state:'';
 const original=await transaction(async db=>{
  const actor=await identity(db,req);await consumeMetaOAuthState(db,actor,'instagram',state);return actor;
 });
 if(req.query.error!==undefined)throw new HttpError(400,'META_AUTHORIZATION_DENIED');
 const started=Date.now();
 const grant=await exchangeInstagramCode(config,typeof req.query.code==='string'?req.query.code:'');
 const expiresAt=new Date(started+grant.expiresIn*1000);
 const account=await discoverInstagramAccount(config,grant);
 try {
  const connection=await transaction(async db=>{
   const actor=await identity(db,req);
   if(actor.user_id!==original.user_id||actor.workspace_id!==original.workspace_id||actor.token_hash!==original.token_hash)
    throw new HttpError(403,'META_IDENTITY_CHANGED');
   return persistInstagramConnection(db,actor,grant,account,key,expiresAt);
  });
  res.set('Referrer-Policy','no-referrer');
  if(req.get('accept')?.includes('text/html')){res.redirect(303,'/app/channels');return;}
  res.json(connection);
 }catch(error){
  if((error as {code?:string}).code==='23505')throw new HttpError(409,'META_ASSET_UNAVAILABLE');
  throw error;
 }
});

metaRouter.post('/integrations/meta/instagram/connections/:id/activate',async(req,res)=>{
 res.json(await activateInstagramConnection(req,String(req.params.id)));
});

// Browser OAuth errors return to a fixed application route without reflecting provider details or codes.
metaRouter.use((error:unknown,req:import('express').Request,res:import('express').Response,next:import('express').NextFunction)=>{
 if(!/^\/integrations\/meta\/(facebook|instagram)\/callback$/.test(req.path)||!req.get('accept')?.includes('text/html')){next(error);return;}
 const code=error instanceof HttpError?error.code:'META_CONNECT_FAILED';
 const safe=['META_AUTHORIZATION_DENIED','META_OAUTH_STATE_INVALID','META_PERMISSIONS_REQUIRED','META_ASSET_UNAVAILABLE','UNAUTHENTICATED','FORBIDDEN','META_NOT_CONFIGURED'].includes(code)?code:'META_CONNECT_FAILED';
 res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer').redirect(303,'/app/channels?meta_error='+safe);
});
