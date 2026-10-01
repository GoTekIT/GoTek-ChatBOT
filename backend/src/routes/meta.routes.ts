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
