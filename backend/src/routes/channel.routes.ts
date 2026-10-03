import {beginFacebookOAuth,completeFacebookOAuth,facebookOAuthAccounts,selectFacebookOAuthAccount} from '../modules/meta/oauth';
import {transaction} from '../core/db';
import {identity} from '../middlewares/auth.middleware';
import {listMetaConnections,disconnectMetaConnection,createMetaConnection,createMetaConnectionsBatch,verifyMetaConnection,subscribeMetaWebhook} from '../modules/meta/connections';
import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {
  createChannel,
  listChannels,
  channelInstallation,
  verifyChannelInstallation,
  channelSettings,
  updateChannelSettings,
  channelAgents,
  updateChannelAgents,
  updateChannelState
} from '../modules/chat/channels';

export const channelRouter = Router();
channelRouter.post('/meta/oauth/start',authed((db,i)=>beginFacebookOAuth(db,i)));
channelRouter.post('/meta/oauth/:id/select',authed((db,i,req)=>selectFacebookOAuthAccount(db,i,String(req.params.id),req.body)));
channelRouter.get('/meta/oauth/:id/accounts',authed((db,i,req)=>facebookOAuthAccounts(db,i,String(req.params.id))));
channelRouter.get('/meta/oauth/callback',async(req,res)=>{
 const result=await transaction(async db=>completeFacebookOAuth(db,await identity(db,req),req.query));
 res.set('Cache-Control','no-store');
 res.set('Referrer-Policy','no-referrer');
 res.redirect(303,`/app/channels?metaSession=${encodeURIComponent(result.sessionId)}`);
});
channelRouter.post('/meta/connections/:id/disconnect', authed((db, i, req) => disconnectMetaConnection(db, i, String(req.params.id))));
channelRouter.post('/meta/connections/batch', authed((db, i, req) => createMetaConnectionsBatch(db, i, req.body)));
channelRouter.post('/meta/connections', authed((db, i, req) => createMetaConnection(db, i, req.body)));
channelRouter.post('/meta/connections/:id/verify', authed((db, i, req) => verifyMetaConnection(db, i, String(req.params.id))));
channelRouter.post('/meta/connections/:id/subscribe-webhook', authed((db, i, req) => subscribeMetaWebhook(db, i, String(req.params.id))));
channelRouter.get('/meta/connections', authed((db, i) => listMetaConnections(db, i)));

channelRouter.get(
  '/channels',
  authed((db, i) => listChannels(db, i))
);

channelRouter.get(
  '/channels/:id/installation',
  authed((db, i, req) => channelInstallation(db, i, String(req.params.id)))
);

channelRouter.get(
  '/channels/:id/verify',
  authed((db, i, req) => verifyChannelInstallation(db, i, String(req.params.id)))
);

channelRouter.get(
  '/channels/:id/settings',
  authed((db, i, req) => channelSettings(db, i, String(req.params.id)))
);

channelRouter.patch(
  '/channels/:id/settings',
  authed((db, i, req) => updateChannelSettings(db, i, String(req.params.id), req.body))
);

channelRouter.get(
  '/channels/:id/agents',
  authed((db, i, req) => channelAgents(db, i, String(req.params.id)))
);

channelRouter.put(
  '/channels/:id/agents',
  authed((db, i, req) => updateChannelAgents(db, i, String(req.params.id), req.body))
);

channelRouter.patch(
  '/channels/:id/state',
  authed((db, i, req) => updateChannelState(db, i, String(req.params.id), req.body))
);

channelRouter.post(
  '/channels',
  authed((db, i, req) => createChannel(db, i, req.body))
);
