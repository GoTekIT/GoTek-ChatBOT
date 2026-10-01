import 'dotenv/config';
import {z} from 'zod';
import {pool,scope,transaction} from '../src/core/db';
import {randomUUID} from 'node:crypto';
const uuid=z.string().uuid();
const workspace=uuid.parse(process.env.META_WORKSPACE_ID);
const configs=[
 ['facebook_messenger','META_PAGE_ID','META_CHANNEL_ID','META_PAGE_TOKEN_REF','META_PAGE_NAME'],
 ['instagram_messaging','META_INSTAGRAM_ACCOUNT_ID','META_INSTAGRAM_CHANNEL_ID','META_INSTAGRAM_TOKEN_REF','META_INSTAGRAM_NAME'],
 ['whatsapp_business','META_WHATSAPP_PHONE_NUMBER_ID','META_WHATSAPP_CHANNEL_ID','META_WHATSAPP_TOKEN_REF','META_WHATSAPP_NAME'],
] as const;
const enabled=configs.filter(([,account,channel])=>process.env[account]||process.env[channel]);
if(!enabled.length)throw new Error('META_BOOTSTRAP_NO_CONNECTION');
try{const rows=await transaction(async db=>{await scope(db,workspace);const out=[];for(const [kind,accountKey,channelKey,tokenKey,nameKey] of enabled){const account=z.string().min(1).max(128).parse(process.env[accountKey]);const channel=uuid.parse(process.env[channelKey]);const tokenRef=z.string().regex(/^META_[A-Z0-9_]+$/).parse(process.env[tokenKey]||`${kind==='facebook_messenger'?'META_PAGE':'META_'+kind.toUpperCase()}_TOKEN`);const name=(process.env[nameKey]||kind).slice(0,200);const row=(await db.query(`INSERT INTO meta_connections(id,workspace_id,channel_id,channel_kind,external_page_id,page_name,page_access_token_ref,status) VALUES($1,$2,$3,$4,$5,$6,$7,'connected') ON CONFLICT(workspace_id,external_page_id) DO UPDATE SET channel_id=EXCLUDED.channel_id,channel_kind=EXCLUDED.channel_kind,page_name=EXCLUDED.page_name,page_access_token_ref=EXCLUDED.page_access_token_ref,status='connected',updated_at=now() RETURNING id,channel_kind,external_page_id`,[randomUUID(),workspace,channel,kind,account,name,tokenRef])).rows[0];out.push(row);}return out;});console.log(JSON.stringify({bootstrapped:rows.map(({id,channel_kind,external_page_id})=>({id,channel_kind,external_page_id}))}));}finally{await pool.end();}
