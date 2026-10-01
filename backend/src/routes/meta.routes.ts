import {Router} from 'express';
import {transaction} from '../core/db';
import {receiveMetaWebhook,verifyMetaWebhook} from '../modules/meta/messenger';
export const metaRouter=Router();
metaRouter.get('/meta/webhook',(req,res)=>{res.type('text/plain').send(verifyMetaWebhook(String(req.query['hub.mode']||''),String(req.query['hub.verify_token']||''),String(req.query['hub.challenge']||'')));});
metaRouter.post('/meta/webhook',(req,res,next)=>{const raw=(req as any).rawBody as Buffer|undefined;transaction(db=>receiveMetaWebhook(db,raw||Buffer.from('{}'),req.get('x-hub-signature-256')||undefined)).then(result=>res.status(200).json(result)).catch(next);});
