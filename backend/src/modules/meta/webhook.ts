import {Router,raw} from 'express';
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {transaction,scope} from '../../core/db';
import {HttpError,digest} from '../../core/security';
import {verifyMetaSignature} from './security';

const payloadSchema=z.object({object:z.literal('page'),entry:z.array(z.object({id:z.string().regex(/^\d{1,100}$/)}).passthrough()).max(100)});
export const metaWebhookRouter=Router();
metaWebhookRouter.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
metaWebhookRouter.get('/facebook/webhook',(req,res)=>{
 const configured=process.env.META_FACEBOOK_VERIFY_TOKEN;
 if(!configured)throw new HttpError(503,'META_NOT_CONFIGURED');
 const token=req.query['hub.verify_token'],challenge=req.query['hub.challenge'];
 if(req.query['hub.mode']!=='subscribe' || typeof token!=='string' || typeof challenge!=='string' || challenge.length>1024
  || !timingSafeEqual(Buffer.from(digest(token),'hex'),Buffer.from(digest(configured),'hex')))
  throw new HttpError(403,'META_VERIFICATION_FAILED');
 res.type('text/plain').send(challenge);
});
metaWebhookRouter.post('/facebook/webhook',raw({type:'application/json',limit:'128kb',inflate:false}),async(req,res)=>{
 const secret=process.env.META_FACEBOOK_APP_SECRET;
 if(!secret)throw new HttpError(503,'META_NOT_CONFIGURED');
 if(!Buffer.isBuffer(req.body) || !verifyMetaSignature(req.body,req.get('x-hub-signature-256'),secret))
  throw new HttpError(403,'META_SIGNATURE_INVALID');
 let parsed:unknown;
 try {parsed=JSON.parse(req.body.toString('utf8'));}catch{throw new HttpError(400,'INVALID_JSON');}
 const validation=payloadSchema.safeParse(parsed);
 if(!validation.success)throw new HttpError(400,'META_PAYLOAD_INVALID');
 await transaction(async db=>{
  for(const entry of validation.data.entry) {
   const mapping=(await db.query("SELECT * FROM resolve_meta_ingress('facebook',$1)",[entry.id])).rows[0];
   if(!mapping)continue;
   await scope(db,mapping.workspace_id);
   if(!(await db.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[mapping.workspace_id])).rowCount)continue;
   // Fence a disconnect/reconnect between resolver and persistence, without trusting incoming workspace IDs.
   const current=await db.query("SELECT id FROM meta_connections WHERE id=$1 AND workspace_id=$2 AND generation=$3 AND status IN ('pending','active') FOR SHARE",[mapping.connection_id,mapping.workspace_id,mapping.generation]);
   if(!current.rowCount)continue;
   const body=JSON.stringify(entry),hash=createHash('sha256').update(body).digest('hex');
   await db.query(`INSERT INTO meta_webhook_receipts(id,workspace_id,connection_id,generation,payload_hash,payload)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(connection_id,generation,payload_hash) DO NOTHING`,
    [randomUUID(),mapping.workspace_id,mapping.connection_id,mapping.generation,hash,body]);
  }
 });
 // Ack only after durable commit. Event-level idempotency belongs to normalization worker.
 res.status(200).type('text/plain').send('EVENT_RECEIVED');
});
