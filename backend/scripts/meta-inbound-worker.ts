import {z} from 'zod';
import {pool,transaction,scope} from '../src/core/db';
import {normalizeFacebookReceipt} from '../src/modules/meta/normalize';
// Explicit tenant batch, using application role/RLS. No globally privileged worker connection.
const workspace=z.string().uuid().parse(process.env.META_WORKSPACE_ID);
const limit=z.coerce.number().int().min(1).max(1000).default(100).parse(process.env.META_BATCH_LIMIT);
if(process.env.NODE_ENV==='production')throw new Error('PRODUCTION_NOT_ENABLED');
try {
 for(let i=0;i<limit;i++) {
  const result=await transaction(async db=>{await scope(db,workspace);return normalizeFacebookReceipt(db,workspace);});
  console.log(JSON.stringify({event:'meta.inbound.batch',...result}));
  if(!['processed','stale'].includes(result.state))break;
 }
}finally{await pool.end();}
