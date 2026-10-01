import {z} from 'zod';
import {pool,transaction,scope} from '../src/core/db';
import {claimFacebookReply,completeFacebookReply} from '../src/modules/meta/outbox';
import {decryptMetaToken} from '../src/modules/meta/security';
import {metaEncryptionKey} from '../src/modules/meta/enrollment';
import {sendFacebookText} from '../src/modules/meta/facebook-send';
import {metaConfig} from '../src/modules/meta/config';
const workspace=z.string().uuid().parse(process.env.META_WORKSPACE_ID);
if(process.env.NODE_ENV==='production')throw new Error('PRODUCTION_NOT_ENABLED');
try {
 // Validate deployment configuration before claiming durable work.
 const config=metaConfig('facebook');
 const encryptionKey=metaEncryptionKey();
 const claimed=await transaction(async db=>{await scope(db,workspace);return claimFacebookReply(db,workspace);});
 if(!claimed){console.log(JSON.stringify({event:'meta.outbound.idle'}));}
 else if(claimed.state==='cancelled'){console.log(JSON.stringify({event:'meta.outbound.cancelled',id:claimed.id}));}
 else {
  let result:{status:'accepted';messageId:string}|{status:'unknown'};
  try {
   const token=decryptMetaToken(claimed.token_ciphertext,encryptionKey,workspace,claimed.asset_id);
   result=await sendFacebookText({version:config.graphVersion,appSecret:config.appSecret,pageId:claimed.asset_id,pageToken:token,recipientId:claimed.recipient_id,text:claimed.body});
  } catch {result={status:'unknown'};}
  const completed=await transaction(async db=>{await scope(db,workspace);return completeFacebookReply(db,workspace,claimed.id,result);});
  console.log(JSON.stringify({event:'meta.outbound.completed',id:claimed.id,...completed}));
 }
}finally{await pool.end();}
