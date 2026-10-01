import {z} from 'zod';
import {pool,transaction,scope} from '../src/core/db';
import {reconcileExpiredMetaReplies} from '../src/modules/meta/outbox';

const workspace=z.string().uuid().parse(process.env.META_WORKSPACE_ID);
if(process.env.NODE_ENV==='production')throw new Error('PRODUCTION_NOT_ENABLED');
try {
 const result=await transaction(async db=>{await scope(db,workspace);return reconcileExpiredMetaReplies(db,workspace);});
 console.log(JSON.stringify({event:'meta.outbox.reconciled',workspace,...result}));
} finally {await pool.end();}
