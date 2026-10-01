import {listMetaConnections,disconnectMetaConnection} from '../modules/meta/connections';
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
channelRouter.post('/meta/connections/:id/disconnect', authed((db, i, req) => disconnectMetaConnection(db, i, String(req.params.id))));
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
