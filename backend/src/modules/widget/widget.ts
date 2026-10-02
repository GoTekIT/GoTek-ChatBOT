import {isWithinBusinessHours} from '../../modules/chat/business-hours';
import {Router} from 'express';import {rateLimit,ipKeyGenerator} from 'express-rate-limit';import {z} from 'zod';import type {PoolClient} from 'pg';import {transaction,scope} from '../../core/db';import {uuid,opaque,digest,HttpError} from '../../core/security';import {appendMessage} from '../../modules/chat/chat-store';import {enqueueJob} from '../../modules/jobs/jobs';
import {realtimeHub} from '../../modules/chat/realtime';
const keySchema=z.string().regex(/^[A-Za-z0-9_-]{40,80}$/);
const widgetRateLimit={windowMs:60000,limit:180,standardHeaders:'draft-7' as const,legacyHeaders:false,message:{error:'RATE_LIMITED'},keyGenerator:(req:any)=>`${ipKeyGenerator(req.ip||'unknown',64)}:${String(req.params.key||'')}`};
export function isOriginAllowed(configuredOrigin: string, requestOrigin: string | undefined): boolean {
  if (!requestOrigin) return false;
  if (configuredOrigin === requestOrigin) return true;
  try {
    const configured = new URL(configuredOrigin);
    const requested = new URL(requestOrigin);
    if (configured.protocol !== requested.protocol) return false;
    if (configured.port !== requested.port) return false;
    const confHost = configured.hostname.toLowerCase();
    const reqHost = requested.hostname.toLowerCase();
    if (reqHost === confHost) return true;
    if (reqHost.endsWith('.' + confHost)) return true;
    const cleanConfHost = confHost.replace(/^www\./, '');
    const cleanReqHost = reqHost.replace(/^www\./, '');
    if (cleanReqHost === cleanConfHost) return true;
    const loopbacks = ['localhost', '127.0.0.1', '::1'];
    if (loopbacks.includes(confHost) && loopbacks.includes(reqHost)) return true;
  } catch {
    return false;
  }
  return false;
}

export function getRequestOrigin(req: {get: (h: string) => string | undefined}): string | undefined {
  const origin = req.get('origin');
  if (origin && origin !== 'null') return origin;
  const referer = req.get('referer');
  if (referer) {
    try {
      const u = new URL(referer);
      return u.origin;
    } catch {}
  }
  return origin || undefined;
}

async function channel(db:PoolClient,key:string,origin:string|undefined){keySchema.parse(key);if(!origin)throw new HttpError(403,'DOMAIN_DENIED');await db.query("SELECT set_config('app.public_key',$1,true)",[key]);const c=(await db.query('SELECT id,workspace_id,origin,name,greeting,color,enabled,business_hours,prechat,widget_title,widget_position,widget_mode,assignment_enabled,assignment_limit FROM channels WHERE public_key=$1',[key])).rows[0];if(!c||!c.enabled||!isOriginAllowed(c.origin,origin))throw new HttpError(403,'DOMAIN_DENIED');await scope(db,c.workspace_id);if(!(await db.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[c.workspace_id])).rowCount)throw new HttpError(403,'DOMAIN_DENIED');if(!(await db.query('SELECT id FROM channels WHERE id=$1 AND enabled FOR SHARE',[c.id])).rowCount)throw new HttpError(403,'DOMAIN_DENIED');return c;}

async function visitor(db:PoolClient,c:any,authorization:string|undefined){const token=authorization?.startsWith('Bearer ')?authorization.slice(7):'';if(!token||token.length>100)throw new HttpError(401,'VISITOR_SESSION_EXPIRED');const v=(await db.query('SELECT v.id,v.profile,c.id conversation_id FROM visitors v JOIN conversations c ON c.visitor_id=v.id AND c.channel_id=v.channel_id AND c.workspace_id=v.workspace_id WHERE v.token_hash=$1 AND v.channel_id=$2 AND v.expires_at>now()',[digest(token),c.id])).rows[0];if(!v)throw new HttpError(401,'VISITOR_SESSION_EXPIRED');return v;}
function profileFor(c:any,raw:unknown,requireRequired=true){const fields=Array.isArray(c.prechat?.fields)?c.prechat.fields:[];const input=z.record(z.string(),z.string().trim().max(500)).default({}).parse(raw);const allowed=new Set(fields.filter((f:any)=>f.enabled).map((f:any)=>f.key));for(const key of Object.keys(input))if(!allowed.has(key))throw new HttpError(400,'INVALID_PRECHAT_FIELD');if(requireRequired&&c.prechat?.enabled)for(const f of fields)if(f.enabled&&f.required&&!String(input[f.key]||'').trim())throw new HttpError(400,'PRECHAT_REQUIRED');if(input.emailAddress&&!z.string().email().safeParse(input.emailAddress).success)throw new HttpError(400,'INVALID_PRECHAT_EMAIL');return input;}
export function widgetRouter(){const router=Router();// Apply limits after the channel key is parsed from the route. A single noisy
 // website must not exhaust the visitor budget for every workspace sharing this API.
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.use('/:key',rateLimit(widgetRateLimit),async(req,res,next)=>{const origin=getRequestOrigin(req);if(origin){res.set('Access-Control-Allow-Origin',origin);res.vary('Origin');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.set('Access-Control-Allow-Headers','Content-Type,Authorization');}try{await transaction(async db=>channel(db,String(req.params.key),origin));if(req.method==='OPTIONS'){res.sendStatus(204);return;}next();}catch(e){next(e);}});
 router.get('/:key/config',async(req,res)=>{res.json(await transaction(async db=>{const c=await channel(db,String(req.params.key),getRequestOrigin(req));return {name:c.name,greeting:c.greeting,color:c.color,widgetTitle:c.widget_title,widgetPosition:c.widget_position,widgetMode:c.widget_mode,available:isWithinBusinessHours(c.business_hours),prechat:c.prechat};}));});
 router.post('/:key/session',async(req,res)=>{const data=z.object({resumeToken:z.string().max(100).optional(),profile:z.record(z.string(),z.string().trim().max(500)).optional()}).strict().parse(req.body);const result=await transaction(async db=>{const c=await channel(db,String(req.params.key),getRequestOrigin(req));const meta={name:c.name,greeting:c.greeting,color:c.color,widgetTitle:c.widget_title,widgetPosition:c.widget_position,widgetMode:c.widget_mode,available:isWithinBusinessHours(c.business_hours),prechat:c.prechat};if(data.resumeToken){const v=await visitor(db,c,`Bearer ${data.resumeToken}`);const state=(await db.query('SELECT reply_owner,owner_version,assigned_to FROM conversations WHERE id=$1',[v.conversation_id])).rows[0];return {token:data.resumeToken,conversationId:v.conversation_id,profile:v.profile,replyOwner:state.reply_owner,ownerVersion:state.owner_version,assignedTo:state.assigned_to,...meta};}const profile=profileFor(c,data.profile||{},!!data.profile);const token=opaque(),id=uuid(),conversationId=uuid();await db.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,profile,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')",[id,c.workspace_id,c.id,digest(token),profile]);await db.query('INSERT INTO conversations(id,workspace_id,channel_id,visitor_id) VALUES($1,$2,$3,$4)',[conversationId,c.workspace_id,c.id,id]);
 if(c.assignment_enabled){
 // Serialize capacity decisions per channel; use a separate statement so the
 // following count sees committed assignments after waiting (READ COMMITTED).
 await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",['assignment:'+c.workspace_id+':'+c.id]);
 await db.query(`WITH eligible AS (SELECT m.user_id, count(*) FILTER (WHERE x.status='open') AS open_count FROM channel_members m JOIN memberships ms ON ms.workspace_id=m.workspace_id AND ms.user_id=m.user_id AND ms.active LEFT JOIN conversations x ON x.workspace_id=m.workspace_id AND x.channel_id=m.channel_id AND x.assigned_to=m.user_id AND x.status='open' WHERE m.workspace_id=$1 AND m.channel_id=$2 GROUP BY m.user_id HAVING $3::integer IS NULL OR count(*) FILTER (WHERE x.status='open') < $3 ORDER BY open_count, m.user_id LIMIT 1) UPDATE conversations c SET assigned_to=e.user_id, updated_at=now() FROM eligible e WHERE c.workspace_id=$1 AND c.id=$4`,[c.workspace_id,c.id,c.assignment_limit,conversationId]);}
 const state=(await db.query('SELECT reply_owner,owner_version FROM conversations WHERE id=$1',[conversationId])).rows[0];return {token,conversationId,profile,replyOwner:state.reply_owner,ownerVersion:state.owner_version,...meta};});res.json(result);});
 router.post('/:key/profile',async(req,res)=>{const data=z.object({profile:z.record(z.string(),z.string().trim().max(500))}).strict().parse(req.body);res.json(await transaction(async db=>{const c=await channel(db,String(req.params.key),getRequestOrigin(req)),v=await visitor(db,c,req.get('authorization'));const profile=profileFor(c,data.profile,true);
  const email=profile.emailAddress?String(profile.emailAddress).trim().toLowerCase():null;
  const phone=profile.phoneNumber?String(profile.phoneNumber).trim():null;
  let existing:any=null;
  if(email||phone){
    existing=(await db.query(`SELECT v.id AS visitor_id, v.profile AS visitor_profile, c.id AS conversation_id, c.reply_owner, c.owner_version, c.status, c.assigned_to FROM visitors v JOIN conversations c ON c.visitor_id=v.id AND c.channel_id=v.channel_id WHERE v.channel_id=$1 AND v.workspace_id=$2 AND v.id<>$3 AND (($4::text IS NOT NULL AND lower(coalesce(v.profile->>'emailAddress',''))=$4) OR ($5::text IS NOT NULL AND coalesce(v.profile->>'phoneNumber','')=$5)) ORDER BY c.updated_at DESC LIMIT 1`,[c.id,c.workspace_id,v.id,email,phone])).rows[0];
  }
  const syncContact=async(fullName:string)=>{
    const owner=(await db.query("SELECT user_id FROM memberships WHERE workspace_id=$1 AND role='Owner' AND active LIMIT 1",[c.workspace_id])).rows[0];
    if(!owner)return;
    const cRow=(await db.query("SELECT id FROM contacts WHERE workspace_id=$1 AND deleted_at IS NULL AND (($2::text IS NOT NULL AND lower(coalesce(email,''))=$2) OR ($3::text IS NOT NULL AND coalesce(phone,'')=$3)) LIMIT 1",[c.workspace_id,email,phone])).rows[0];
    if(cRow){
      await db.query("UPDATE contacts SET full_name=coalesce($2,full_name),email=coalesce($3,email),phone=coalesce($4,phone),updated_at=now() WHERE id=$1",[cRow.id,fullName,email,phone]);
    } else {
      await db.query("INSERT INTO contacts(id,workspace_id,full_name,email,phone,created_by) VALUES($1,$2,$3,$4,$5,$6)",[uuid(),c.workspace_id,fullName,email,phone,owner.user_id]);
    }
  };
  if(existing){
    const merged={...(existing.visitor_profile||{}),...profile};
    const newToken=opaque();
    await db.query("UPDATE visitors SET token_hash=$1, profile=$2, expires_at=now()+interval '7 days' WHERE id=$3",[digest(newToken),merged,existing.visitor_id]);
    if(existing.status!=='open'){
      await db.query("UPDATE conversations SET status='open',updated_at=now() WHERE id=$1",[existing.conversation_id]);
    }
    const hasMsg=(await db.query('SELECT 1 FROM messages WHERE conversation_id=$1 LIMIT 1',[v.conversation_id])).rowCount;
    if(!hasMsg){
      await db.query('DELETE FROM conversations WHERE id=$1',[v.conversation_id]);
      await db.query('DELETE FROM visitors WHERE id=$1',[v.id]);
    }
    if(profile.fullName)await syncContact(profile.fullName);
    return {profile:merged,token:newToken,conversationId:existing.conversation_id,replyOwner:existing.reply_owner,ownerVersion:existing.owner_version,assignedTo:existing.assigned_to,resumed:true};
  }
  const row=(await db.query('UPDATE visitors SET profile=$1 WHERE id=$2 RETURNING profile',[profile,v.id])).rows[0];
  if(profile.fullName)await syncContact(profile.fullName);
  const state=(await db.query('SELECT reply_owner,owner_version FROM conversations WHERE id=$1',[v.conversation_id])).rows[0];
  return {profile:row.profile,conversationId:v.conversation_id,replyOwner:state.reply_owner,ownerVersion:state.owner_version,resumed:false};
 }));});
 router.get('/:key/stream',async(req,res,next)=>{
  try{
    const origin=getRequestOrigin(req);
    const tokenParam=typeof req.query.token==='string'?req.query.token:undefined;
    const authHeader=req.get('authorization')||(tokenParam?`Bearer ${tokenParam}`:undefined);
    let workspaceId:string;
    let conversationId:string;
    await transaction(async db=>{
      const c=await channel(db,String(req.params.key),origin);
      const v=await visitor(db,c,authHeader);
      workspaceId=c.workspace_id;
      conversationId=v.conversation_id;
    });
    realtimeHub.register(uuid(),workspaceId!,res,req,conversationId!,true);
  }catch(e){
    next(e);
  }
 });
 router.get('/:key/state',async(req,res)=>{res.json(await transaction(async db=>{const c=await channel(db,String(req.params.key),getRequestOrigin(req)),v=await visitor(db,c,req.get('authorization'));const state=(await db.query('SELECT reply_owner,owner_version FROM conversations WHERE id=$1 AND workspace_id=$2',[v.conversation_id,c.workspace_id])).rows[0];return {replyOwner:state.reply_owner,ownerVersion:state.owner_version};}));});
 router.get('/:key/messages',async(req,res)=>{const after=z.coerce.number().int().min(0).default(0).parse(req.query.after);res.json(await transaction(async db=>{const c=await channel(db,String(req.params.key),getRequestOrigin(req)),v=await visitor(db,c,req.get('authorization'));return (await db.query("SELECT id,client_id,sequence,author_type,body,created_at FROM messages WHERE conversation_id=$1 AND visibility='public' AND sequence>$2 ORDER BY sequence LIMIT 100",[v.conversation_id,after])).rows;}));});
 router.post('/:key/messages',async(req,res)=>{const data=z.object({clientId:z.string().uuid(),body:z.string().trim().min(1).max(10000)}).strict().parse(req.body);res.json(await transaction(async db=>{const c=await channel(db,String(req.params.key),getRequestOrigin(req)),v=await visitor(db,c,req.get('authorization'));if(c.prechat?.enabled){
 const enabledKeys=new Set((c.prechat.fields||[]).filter((f:any)=>f.enabled).map((f:any)=>f.key));
 const currentProfile=Object.fromEntries(Object.entries(v.profile||{}).filter(([key])=>enabledKeys.has(key)));
 profileFor(c,currentProfile,true);
 }await db.query('SELECT id FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[v.conversation_id,c.workspace_id]);
 const replay=!!(await db.query('SELECT id FROM messages WHERE conversation_id=$1 AND workspace_id=$2 AND client_id=$3',[v.conversation_id,c.workspace_id,data.clientId])).rowCount;
 const m=await appendMessage(db,{workspace:c.workspace_id,conversation:v.conversation_id,clientId:data.clientId,body:data.body,author:'visitor',visibility:'public'});const state=(await db.query('SELECT reply_owner,owner_version,assigned_to FROM conversations WHERE id=$1',[v.conversation_id])).rows[0];if(!replay&&state.reply_owner==='AI_ACTIVE'){await enqueueJob(db,c.workspace_id,{kind:'ai.reply',key:`conversation:${v.conversation_id}:message:${m.id}`,payload:{conversationId:v.conversation_id,messageId:m.id,ownerVersion:state.owner_version,requireGrounded:true},external:false});}
 realtimeHub.broadcastToConversation(v.conversation_id, 'message:new', m);
 realtimeHub.broadcastToWorkspace(c.workspace_id, 'inbox:visitor_message', { conversationId: v.conversation_id, messageSnippet: m.body.slice(0, 100), author: 'visitor', createdAt: m.created_at });
 return {id:m.id,client_id:m.client_id,sequence:m.sequence,body:m.body,author_type:m.author_type,created_at:m.created_at,replyOwner:state.reply_owner,ownerVersion:state.owner_version,assignedTo:state.assigned_to};}));});
 // A visitor may request a human, but may never choose an agent or resume AI.
 router.post('/:key/handoff',async(req,res)=>{
   z.object({}).strict().parse(req.body);
   res.json(await transaction(async db=>{
    const c=await channel(db,String(req.params.key),getRequestOrigin(req)),v=await visitor(db,c,req.get('authorization'));
    const state=(await db.query('SELECT reply_owner,owner_version FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[v.conversation_id,c.workspace_id])).rows[0];
    // Explicit new support request reopens the inbox; preserve an existing human owner.
    await db.query("UPDATE conversations SET status='open',updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status<>'open'",[v.conversation_id,c.workspace_id]);
    if(state.reply_owner!=='AI_ACTIVE')return {replyOwner:state.reply_owner,ownerVersion:state.owner_version};

    const changed=(await db.query("UPDATE conversations SET reply_owner='HANDOFF_PENDING',owner_version=owner_version+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING reply_owner,owner_version",[v.conversation_id,c.workspace_id])).rows[0];
    realtimeHub.broadcastToConversation(v.conversation_id, 'conversation:takeover', {
      conversationId: v.conversation_id,
      replyOwner: changed?.reply_owner || 'HANDOFF_PENDING',
      ownerVersion: changed?.owner_version || state.owner_version,
      status: 'handoff'
    });
    realtimeHub.broadcastToWorkspace(c.workspace_id, 'inbox:visitor_message', {
      conversationId: v.conversation_id,
      messageSnippet: '🔴 Khách hàng yêu cầu hỗ trợ từ nhân viên (Handoff)',
      author: 'system',
      createdAt: new Date().toISOString()
    });
    return {replyOwner:changed.reply_owner,ownerVersion:changed.owner_version};
   }));
  });
  router.post('/:key/typing', async (req, res) => {
   const data = z.object({ isTyping: z.boolean() }).parse(req.body);
   res.json(await transaction(async db => {
     const c = await channel(db, String(req.params.key), getRequestOrigin(req)),
       v = await visitor(db, c, req.get('authorization'));
     realtimeHub.broadcastToConversation(v.conversation_id, 'typing', {
       conversationId: v.conversation_id,
       actorId: v.id,
       actorType: 'visitor',
       isTyping: data.isTyping,
       timestamp: new Date().toISOString(),
     });
     return { ok: true };
   }));
 });
 router.post('/:key/receipts',async(req,res)=>{const data=z.object({messageIds:z.array(z.string().uuid()).min(1).max(100)}).strict().parse(req.body);res.json(await transaction(async db=>{const c=await channel(db,String(req.params.key),getRequestOrigin(req)),v=await visitor(db,c,req.get('authorization'));const rows=await db.query("UPDATE messages SET visitor_received_at=coalesce(visitor_received_at,now()) WHERE conversation_id=$1 AND visibility='public' AND author_type IN ('agent','ai') AND id=ANY($2::uuid[]) RETURNING id",[v.conversation_id,data.messageIds]);return {received:rows.rows.map(r=>r.id)};}));});return router;
}
