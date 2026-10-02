import {Router} from 'express';
import {transaction} from '../core/db';
import {receiveMetaWebhook,verifyMetaWebhook} from '../modules/meta/messenger';
import {META_CONNECTORS} from '../modules/meta/connectors';
import {authed} from '../middlewares/auth.middleware';
import {listQuarantinedMetaEvents,replayQuarantinedMetaEvent,claimQuarantinedMetaEvent} from '../modules/meta/quarantine';
export const metaRouter=Router();
// Public capability catalogue: never includes credentials or workspace data.
metaRouter.get('/meta/connectors',(_req,res)=>res.json({connectors:META_CONNECTORS}));
metaRouter.get('/meta/webhook',(req,res)=>{res.type('text/plain').send(verifyMetaWebhook(String(req.query['hub.mode']||''),String(req.query['hub.verify_token']||''),String(req.query['hub.challenge']||'')));});
metaRouter.post('/meta/webhook',(req,res,next)=>{
 const raw=(req as any).rawBody as Buffer|undefined;
 const afterCommit:Array<()=>void>=[];
 transaction(db=>receiveMetaWebhook(db,raw||Buffer.from('{}'),req.get('x-hub-signature-256')||undefined,afterCommit))
  .then(result=>{
   // Persistence has committed. A realtime listener failure must not turn a
   // durable receipt into a webhook failure and trigger unnecessary redelivery.
   for(const publish of afterCommit){try{publish();}catch{console.warn('META_REALTIME_PUBLISH_FAILED');}}
   res.status(200).json(result);
  }).catch(next);
});
metaRouter.get('/meta/quarantine',authed((db,i)=>listQuarantinedMetaEvents(db,i)));
metaRouter.post('/meta/quarantine/:id/replay',authed((db,i,req)=>replayQuarantinedMetaEvent(db,i,String(req.params.id))));
metaRouter.post('/meta/quarantine/:id/claim',authed((db,i,req)=>claimQuarantinedMetaEvent(db,i,String(req.params.id),String(req.body.connectionId))));
