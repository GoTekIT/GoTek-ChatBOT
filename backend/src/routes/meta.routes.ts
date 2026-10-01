import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {listMetaConnections,disconnectMetaConnection} from '../modules/meta/connections';

export const metaRouter = Router();
metaRouter.get('/integrations/meta/connections',authed(
 (db,actor)=>listMetaConnections(db,actor),'channels.manage'
));
// This endpoint disconnects GoTek processing; it does not claim to revoke Meta permissions.
metaRouter.post('/integrations/meta/connections/:id/disconnect',authed(
 (db,actor,req)=>disconnectMetaConnection(db,actor,String(req.params.id)),'channels.manage'
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
 res.set('Referrer-Policy','no-referrer').json({enrollmentId,next:'select_page'});
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
