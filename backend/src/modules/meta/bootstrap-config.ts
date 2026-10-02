import {z} from 'zod';

const fields=[
 ['facebook_messenger','META_PAGE_ID','META_CHANNEL_ID','META_PAGE_TOKEN_REF','META_PAGE_NAME'],
 ['instagram_messaging','META_INSTAGRAM_ACCOUNT_ID','META_INSTAGRAM_CHANNEL_ID','META_INSTAGRAM_TOKEN_REF','META_INSTAGRAM_NAME'],
 ['whatsapp_business','META_WHATSAPP_PHONE_NUMBER_ID','META_WHATSAPP_CHANNEL_ID','META_WHATSAPP_TOKEN_REF','META_WHATSAPP_NAME'],
] as const;

/** Validate all inputs before opening a transaction; never include input values in errors. */
export function metaBootstrapConfig(env:NodeJS.ProcessEnv){
 if(env.NODE_ENV==='production')throw new Error('META_BOOTSTRAP_PRODUCTION_DISABLED');
 const workspace=z.string().uuid().safeParse(env.META_WORKSPACE_ID);
 if(!workspace.success)throw new Error('META_BOOTSTRAP_WORKSPACE_INVALID');
 const connections=fields.filter(([,account,channel])=>env[account]||env[channel]).map(([kind,accountKey,channelKey,tokenKey,nameKey])=>{
  const account=z.string().regex(/^\d{1,128}$/).safeParse(env[accountKey]);
  const channel=z.string().uuid().safeParse(env[channelKey]);
  const tokenRef=z.string().regex(/^META_[A-Z0-9_]+$/).safeParse(env[tokenKey]);
  if(!account.success||!channel.success||!tokenRef.success)throw new Error('META_BOOTSTRAP_CONFIG_INVALID');
  if(!env[tokenRef.data]?.trim())throw new Error('META_BOOTSTRAP_TOKEN_MISSING');
  return {kind,account:account.data,channel:channel.data,tokenRef:tokenRef.data,name:(env[nameKey]||kind).slice(0,200)};
 });
 if(!connections.length)throw new Error('META_BOOTSTRAP_NO_CONNECTION');
 if(new Set(connections.map(c=>c.channel)).size!==connections.length||new Set(connections.map(c=>c.account)).size!==connections.length)throw new Error('META_BOOTSTRAP_DUPLICATE_MAPPING');
 return {workspace:workspace.data,connections};
}
