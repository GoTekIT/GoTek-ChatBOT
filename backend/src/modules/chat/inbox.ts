import type {PoolClient} from 'pg';
import {z} from 'zod';
import {HttpError,audit,uuid} from '../../core/security';
import {appendMessage,takeover} from './chat-store';
import {enqueueJob} from '../jobs/jobs';
import {realtimeHub} from './realtime';

export type Actor={workspace_id:string,user_id:string,role:string};
function metaPlatformLabel(value:string|null|undefined){return value==='facebook_messenger'?'Facebook Messenger':value==='instagram_messaging'?'Instagram':value==='whatsapp_business'?'WhatsApp':value==='threads'?'Threads':value||'';}

export async function access(db:PoolClient,a:Actor,id:string){
 z.string().uuid().parse(id);
 const c=(await db.query('SELECT * FROM conversations WHERE id=$1 AND workspace_id=$2',[id,a.workspace_id])).rows[0];if(!c)throw new HttpError(404,'NOT_FOUND');
 if(!(await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 AND enabled FOR SHARE',[c.channel_id,a.workspace_id])).rowCount)throw new HttpError(404,'NOT_FOUND');
 if(!['Owner','Admin'].includes(a.role)&&!(await db.query('SELECT user_id FROM channel_members WHERE workspace_id=$1 AND channel_id=$2 AND user_id=$3 FOR SHARE',[a.workspace_id,c.channel_id,a.user_id])).rowCount)throw new HttpError(404,'NOT_FOUND');
 return c;
}

export async function inboxList(db:PoolClient,a:Actor,query?:unknown){
  const q=z.object({
    connectionIds:z.preprocess(v=>typeof v==='string'?[v]:v,z.array(z.string().uuid()).max(100).optional()),
    platforms:z.preprocess(v=>typeof v==='string'?[v]:v,z.array(z.enum(['facebook_messenger','instagram_messaging','whatsapp_business','threads'])).max(4).optional()),
    search:z.string().trim().max(120).optional(),
    status:z.enum(['open','resolved','snoozed']).optional(),
    assigned:z.enum(['mine','unassigned']).optional(),
    filter:z.enum(['all','queue','bot','mine']).optional()
  }).parse(query||{});

  const p:any[]=[a.workspace_id,['Owner','Admin'].includes(a.role),a.user_id];
  let filterClause='';
  if(q.status){
    p.push(q.status);
    filterClause+=` AND c.status=$${p.length}`;
  }
  if(q.filter==='queue'){
    filterClause+=` AND c.reply_owner='HANDOFF_PENDING'`;
  } else if(q.filter==='bot'){
    filterClause+=` AND c.reply_owner='AI_ACTIVE'`;
  } else if(q.filter==='mine'||q.assigned==='mine'){
    filterClause+=` AND c.assigned_to=$3`;
  } else if(q.assigned==='unassigned'){
    filterClause+=` AND c.assigned_to IS NULL`;
  }

  if(q.connectionIds?.length){
    p.push(q.connectionIds);
    filterClause+=` AND COALESCE(source.id,legacy.id)=ANY($${p.length}::uuid[])`;
  }
  if(q.platforms?.length){
    p.push(q.platforms);
    filterClause+=` AND COALESCE(source.channel_kind,legacy.channel_kind)=ANY($${p.length}::text[])`;
  }

  if(q.search){
    p.push(`%${q.search}%`);
    filterClause+=` AND (h.name ILIKE $${p.length} OR coalesce(v.profile->>'fullName','') ILIKE $${p.length} OR coalesce(v.profile->>'name','') ILIKE $${p.length} OR coalesce(v.profile->>'emailAddress','') ILIKE $${p.length} OR coalesce(v.profile->>'phoneNumber','') ILIKE $${p.length} OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=c.id AND m.body ILIKE $${p.length}))`;
  }

  const sql=`SELECT source.id AS connection_id,
 COALESCE(source.page_name,legacy.page_name) AS account_name,
 COALESCE(source.external_page_id,legacy.external_page_id) AS external_account_id,
 COALESCE(source.status,legacy.status) AS connection_status,
 c.id, c.channel_id, c.status, c.reply_owner, c.owner_version, c.assigned_to, c.updated_at, c.created_at,
 h.name AS channel_name, h.origin AS website_url,
 COALESCE(source.channel_kind,legacy.channel_kind,h.widget_mode) AS channel_type,
 v.profile AS visitor_profile,
 (SELECT jsonb_build_object('id',m.id,'sequence',m.sequence,'author_type',m.author_type,'visibility',m.visibility) FROM messages m WHERE m.conversation_id=c.id ORDER BY m.sequence DESC LIMIT 1) AS last_message_meta,
 (SELECT m.body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.sequence DESC LIMIT 1) AS last_message_body,
 (SELECT m.created_at FROM messages m WHERE m.conversation_id=c.id ORDER BY m.sequence DESC LIMIT 1) AS last_message_created_at,
 COALESCE((SELECT jsonb_agg(ct.name ORDER BY ct.name) FROM conversation_tags ct WHERE ct.workspace_id=c.workspace_id AND ct.conversation_id=c.id),'[]'::jsonb) AS conversation_tags
 FROM conversations c JOIN channels h ON h.id=c.channel_id AND h.workspace_id=c.workspace_id
 JOIN visitors v ON v.id=c.visitor_id
 LEFT JOIN meta_connections source ON source.workspace_id=c.workspace_id AND source.channel_id=c.channel_id AND source.id=c.connection_id
 LEFT JOIN LATERAL (SELECT mc.id,mc.page_name,mc.external_page_id,mc.status,mc.channel_kind FROM meta_connections mc
  WHERE c.connection_id IS NULL AND mc.channel_id=c.channel_id AND mc.workspace_id=c.workspace_id
  AND v.token_hash='meta:'||mc.id::text||':'||(v.profile->>'metaUserId') ORDER BY mc.created_at ASC,mc.id ASC LIMIT 1) legacy ON true
 WHERE c.workspace_id=$1 AND h.enabled AND ($2::boolean OR EXISTS(SELECT 1 FROM channel_members m WHERE m.workspace_id=c.workspace_id AND m.channel_id=c.channel_id AND m.user_id=$3) ) ${filterClause} ORDER BY c.updated_at DESC LIMIT 100`;

  const rows=(await db.query(sql,p)).rows;

  return rows.map((r:any)=>{
    const prof=r.visitor_profile||{};
    const name=prof.fullName?.trim()||prof.name?.trim()||'Khách vãng lai';
    const email=prof.emailAddress?.trim()||prof.email?.trim()||'';
    const phone=prof.phoneNumber?.trim()||prof.phone?.trim()||'';
    const company=prof.company?.trim()||'';

    let uiStatus:'handoff'|'ai_active'|'in_review'|'resolved'='ai_active';
    if(r.status==='resolved')uiStatus='resolved';
    else if(r.reply_owner==='HANDOFF_PENDING')uiStatus='handoff';
    else if(r.reply_owner==='HUMAN_ACTIVE')uiStatus='in_review';
    else uiStatus='ai_active';

    const lastTime=r.last_message_created_at||r.updated_at;
    let timeStr='1m ago';
    if(lastTime){
      const diffMins=Math.floor((Date.now()-new Date(lastTime).getTime())/60000);
      if(diffMins<1)timeStr='Vừa xong';
      else if(diffMins<60)timeStr=`${diffMins}m ago`;
      else {
        const diffH=Math.floor(diffMins/60);
        if(diffH<24)timeStr=`${diffH}h ago`;
        else timeStr=`${Math.floor(diffH/24)}d ago`;
      }
    }

    const avatar=`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`;

    return {
      ...r,
      connectionId:r.connection_id,
      platform:r.connection_id?r.channel_type:null,
      accountName:r.account_name,
      externalAccountId:r.external_account_id,
      connectionStatus:r.connection_status,
      sourceLabel:r.channel_type && r.account_name ? `${metaPlatformLabel(r.channel_type)} · ${r.account_name}` : null,
      channel_name:r.channel_name,
      reply_owner:r.reply_owner,
      owner_version:r.owner_version,
      assigned_to:r.assigned_to,
      customerName:name,
      customerCompany:company,
      customerEmail:email,
      customerPhone:phone,
      customerLocation:prof.location||'',
      customerAvatar:prof.avatarUrl||avatar,
      clientTier:prof.clientTier||'',
      websiteUrl:['facebook_messenger','instagram_messaging','whatsapp_business','threads'].includes(r.channel_type)?'':r.website_url||'',
      lastMessageSnippet:r.last_message_body||'Bắt đầu cuộc trò chuyện mới...',
      lastMessageTime:timeStr,
      channel:r.channel_type==='facebook_messenger'?'Facebook Messenger':r.channel_type==='instagram_messaging'?'Instagram':r.channel_type==='whatsapp_business'?'WhatsApp':r.channel_type==='threads'?'Threads':r.channel_type==='slack'?'Slack App':r.channel_type==='email'?'Email':'Widget',
      status:uiStatus,
      assignedTo:r.assigned_to||undefined,
      ownerVersion:r.owner_version,
      activeUrl:prof.activeUrl||'',
      sessionDuration:prof.sessionDuration||'',
      deviceInfo:prof.deviceInfo||'',
      ragMatchScore:'',
      ragCitations:[],
      crmTags:Array.isArray(r.conversation_tags)?r.conversation_tags:(Array.isArray(prof.crmTags)?prof.crmTags:[]),
      messages: r.last_message_body ? [{
        id: r.last_message_meta.id,
        sequence: r.last_message_meta.sequence,
        author_type: r.last_message_meta.author_type,
        visibility: r.last_message_meta.visibility,
        senderType: r.last_message_meta.visibility==='internal'?'internal_note':r.last_message_meta.author_type==='visitor'?'customer':r.last_message_meta.author_type,
        senderName: r.last_message_meta.author_type==='visitor'?name:r.last_message_meta.author_type==='ai'?'GoTek AI Copilot':'Nhân viên',
        timestamp: timeStr,
        content: r.last_message_body
      }] : []
    };
  });
}

export async function inboxMessages(db:PoolClient,a:Actor,id:string,after:unknown){
  const c=await access(db,a,id);
  const cursor=z.coerce.number().int().min(0).default(0).parse(after);
  const visitorRow=(await db.query('SELECT profile FROM visitors WHERE id=$1',[c.visitor_id])).rows[0];
  const visitorName=visitorRow?.profile?.fullName||visitorRow?.profile?.name||'Khách hàng';

  const staffMap:Record<string,string>={};
  const staffRows=(await db.query('SELECT m.user_id,u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1',[a.workspace_id])).rows;
  for(const s of staffRows){
    staffMap[s.user_id]=s.email.split('@')[0];
  }

  const rows=(await db.query("SELECT m.id,m.client_id,m.sequence,m.author_type,m.visibility,m.body,m.actor_id,m.visitor_received_at,m.created_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('type',a.kind,'url',a.url) ORDER BY a.created_at) FROM message_attachments a WHERE a.message_id=m.id AND a.workspace_id=m.workspace_id),'[]'::jsonb) AS attachments FROM messages m WHERE m.conversation_id=$1 AND m.sequence>$2 ORDER BY m.sequence LIMIT 100",[id,cursor])).rows;

  return rows.map((m:any)=>{
    let senderType:'customer'|'ai'|'agent'|'internal_note'|'system_event'='customer';
    let senderName=visitorName;
    let senderRole:string|undefined=undefined;

    if(m.author_type==='visitor'){
      senderType='customer';
      senderName=visitorName;
    } else if(m.author_type==='ai'){
      senderType='ai';
      senderName='GoTek AI Copilot';
      senderRole='Neural Core';
    } else if(m.author_type==='agent'){
      if(m.visibility==='internal'){
        senderType='internal_note';
        senderName=staffMap[m.actor_id]?staffMap[m.actor_id]:'Nhân viên';
        senderRole='Chỉ nhân viên xem được';
      } else {
        senderType='agent';
        senderName=staffMap[m.actor_id]?staffMap[m.actor_id]:'Nhân viên';
        senderRole='Chuyên viên Hỗ trợ';
      }
    }

    const timeDate=new Date(m.created_at);
    const timeFormatted=timeDate.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    const status = m.visitor_received_at ? 'delivered' : 'sent';

    return {
      ...m,
      senderType,
      senderName,
      senderRole,
      timestamp:timeFormatted,
      content:m.body,
      status
    };
  });
}

export async function inboxTakeover(db:PoolClient,a:Actor,id:string,body?:unknown){
  const c=await access(db,a,id);
  const data=z.object({version:z.number().int().positive().optional()}).default({}).parse(body||{});
  const version=data.version??c.owner_version;
  const result=await takeover(db,a.workspace_id,id,a.user_id,version);
  await audit(db,a.workspace_id,a.user_id,'conversation.takeover',id);

  realtimeHub.broadcastToConversation(id,'conversation:takeover',{
    conversationId:id,
    assignedTo:a.user_id,
    replyOwner:result.reply_owner,
    ownerVersion:result.owner_version,
  });
  realtimeHub.broadcastToWorkspace(a.workspace_id,'inbox:takeover',{
    conversationId:id,
    assignedTo:a.user_id,
  });

  return result;
}

export async function inboxSend(db:PoolClient,a:Actor,id:string,body:unknown,afterCommit:Array<()=>void>=[]){
  await access(db,a,id);
  const data=z.object({clientId:z.string().uuid(),body:z.string().trim().min(1).max(10000),visibility:z.enum(['public','internal']),media:z.object({type:z.enum(['image','video','audio','file']),url:z.string().url().max(8192)}).optional()}).strict().parse(body);
  // Serialize retries before checking current connector availability. A committed
  // request remains replayable after disconnect without creating a new send job.
  await db.query('SELECT id FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,a.workspace_id]);
  const existing=(await db.query('SELECT id FROM messages WHERE workspace_id=$1 AND conversation_id=$2 AND client_id=$3',[a.workspace_id,id,data.clientId])).rowCount;
  if(existing) return appendMessage(db,{workspace:a.workspace_id,conversation:id,clientId:data.clientId,body:data.body,visibility:data.visibility,author:'agent',actor:a.user_id,attachments:data.media?[data.media]:[]});
  let meta: {id:string;page_access_token_ref:string;recipient_id:string} | undefined;
  if(data.visibility==='public') {
    const visitor=(await db.query("SELECT v.profile FROM conversations c JOIN visitors v ON v.id=c.visitor_id WHERE c.id=$1 AND c.workspace_id=$2",[id,a.workspace_id])).rows[0];
    if(visitor?.profile?.metaUserId) {
      const routes=(await db.query("SELECT mc.id,mc.page_access_token_ref,v.token_hash AS identity_binding,v.profile->>'metaUserId' AS recipient_id FROM conversations c JOIN visitors v ON v.id=c.visitor_id JOIN meta_connections mc ON mc.id=c.connection_id AND mc.channel_id=c.channel_id AND mc.workspace_id=c.workspace_id WHERE c.id=$1 AND c.workspace_id=$2 AND mc.status='connected' AND mc.channel_kind IN ('facebook_messenger','instagram_messaging','whatsapp_business') FOR SHARE OF mc",[id,a.workspace_id])).rows;
      if(routes.length!==1 || routes[0].identity_binding!==`meta:${routes[0].id}:${routes[0].recipient_id}`) throw new HttpError(409,'META_CONNECTION_UNAVAILABLE');
      meta=routes[0];
    }
  }
  const msgId = uuid();
  const message=await appendMessage(db,{workspace:a.workspace_id,conversation:id,clientId:data.clientId,body:data.body,visibility:data.visibility,author:'agent',actor:a.user_id,messageId:msgId,attachments:data.media?[data.media]:[]});
  if(data.visibility==='public'){

    if(meta?.recipient_id) await enqueueJob(db,a.workspace_id,{kind:'meta.message.send',key:`meta-send:${id}:${data.clientId}`,payload:{conversationId:id,messageId:message.id,connectionId:meta.id},external:true,maxAttempts:3});
  }

  // Only a newly inserted message publishes, with the durable ID and sequence.
  if(message.id===msgId) afterCommit.push(()=>{
    realtimeHub.broadcastToConversation(id,'message:new',{...message,clientId:data.clientId});
    realtimeHub.broadcastToWorkspace(a.workspace_id,'inbox:message_sent',{
      conversationId:id,messageSnippet:message.body.slice(0,100),author:message.author_type,
      visibility:message.visibility,createdAt:message.created_at,
    });
  });

  return message;
}

export async function inboxSetStatus(db:PoolClient,a:Actor,id:string,body:unknown){
 await access(db,a,id);
 const data=z.object({status:z.enum(['open','resolved','snoozed'])}).strict().parse(body);
 const current=(await db.query('SELECT status FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,a.workspace_id])).rows[0];
 if(!current)throw new HttpError(404,'NOT_FOUND');
 const row=(await db.query('UPDATE conversations SET status=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3 RETURNING id,status,updated_at',[data.status,id,a.workspace_id])).rows[0];
 if(!row)throw new HttpError(404,'NOT_FOUND');
 await audit(db,a.workspace_id,a.user_id,`conversation.${data.status}`,id);

 // Broadcast realtime status change event
 realtimeHub.broadcastToConversation(id, 'conversation:status', row);
 realtimeHub.broadcastToWorkspace(a.workspace_id, 'inbox:status_changed', {
   conversationId: id,
   status: row.status,
 });

 return {...row,previousStatus:current.status};
}

/** Explicit return to AI; never triggered automatically by a visitor message. */
export async function inboxResumeAi(db:PoolClient,a:Actor,id:string,body:unknown){
 await access(db,a,id);
 const data=z.object({version:z.number().int().positive().optional()}).default({}).parse(body||{});
 const current=(await db.query('SELECT reply_owner,owner_version,assigned_to FROM conversations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,a.workspace_id])).rows[0];
 if(!current)throw new HttpError(404,'NOT_FOUND');
 const version=data.version??current.owner_version;
 if(current.owner_version!==version)throw new HttpError(409,'STALE_REPLY_OWNER');
 if(!['Owner','Admin'].includes(a.role)&&current.assigned_to!==a.user_id)throw new HttpError(403,'FORBIDDEN');
 if(current.reply_owner==='AI_ACTIVE')throw new HttpError(409,'INVALID_STATE');
 const row=(await db.query("UPDATE conversations SET reply_owner='AI_ACTIVE',assigned_to=NULL,owner_version=owner_version+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING id,reply_owner,owner_version,assigned_to",[id,a.workspace_id])).rows[0];
 await audit(db,a.workspace_id,a.user_id,'conversation.ai_resumed',id);

 // Broadcast realtime AI resume event
 realtimeHub.broadcastToConversation(id, 'conversation:ai_resumed', row);
 realtimeHub.broadcastToWorkspace(a.workspace_id, 'inbox:ai_resumed', {
   conversationId: id,
   replyOwner: row.reply_owner,
 });

 return row;
}

export async function inboxAssign(db:PoolClient,a:Actor,id:string,body:unknown){
  const c = await access(db,a,id);
  const data=z.object({
    assignedTo:z.string().uuid(),
    version:z.number().int().positive().optional()
  }).parse(body);

  const version = data.version ?? c.owner_version;
  if (c.owner_version !== version) throw new HttpError(409, 'STALE_REPLY_OWNER');

  const member=(await db.query(`SELECT m.user_id FROM memberships m WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.active`,[a.workspace_id,data.assignedTo])).rows[0];
  if(!member)throw new HttpError(400,'INVALID_ASSIGNEE');

  const row=(await db.query(`UPDATE conversations SET assigned_to=$1, reply_owner='HUMAN_ACTIVE', owner_version=owner_version+1, updated_at=now() WHERE id=$2 AND workspace_id=$3 RETURNING id, assigned_to, reply_owner, owner_version, updated_at`,[data.assignedTo,id,a.workspace_id])).rows[0];
  await audit(db,a.workspace_id,a.user_id,'conversation.assigned',id);

  realtimeHub.broadcastToConversation(id,'conversation:takeover',{
    conversationId:id,
    assignedTo:data.assignedTo,
    replyOwner:row.reply_owner,
    ownerVersion:row.owner_version,
  });
  realtimeHub.broadcastToWorkspace(a.workspace_id,'inbox:takeover',{
    conversationId:id,
    assignedTo:data.assignedTo,
  });

  return row;
}

export async function inboxDetail(db:PoolClient,a:Actor,id:string){
  const c=await access(db,a,id);
  const messages=await inboxMessages(db,a,id,0);

  const channelRow=(await db.query("SELECT name, origin, widget_mode, (SELECT mc.channel_kind FROM meta_connections mc WHERE mc.channel_id=channels.id AND mc.workspace_id=channels.workspace_id AND (mc.id=c.connection_id OR (c.connection_id IS NULL AND EXISTS(SELECT 1 FROM visitors v WHERE v.id=$2 AND v.token_hash='meta:'||mc.id::text||':'||(v.profile->>'metaUserId')))) ORDER BY mc.created_at ASC, mc.id ASC LIMIT 1) AS channel_kind, EXISTS(SELECT 1 FROM meta_connections mc WHERE mc.channel_id=channels.id AND mc.workspace_id=channels.workspace_id AND mc.status='connected') AS is_facebook_messenger FROM channels JOIN conversations c ON c.channel_id=channels.id AND c.id=$3 WHERE channels.id=$1",[c.channel_id,c.visitor_id,id])).rows[0];
  const visitorRow=(await db.query('SELECT profile FROM visitors WHERE id=$1',[c.visitor_id])).rows[0];
  const conversationTags=(await db.query('SELECT name FROM conversation_tags WHERE workspace_id=$1 AND conversation_id=$2 ORDER BY name',[a.workspace_id,id])).rows.map((row:any)=>row.name);

  const source=(await db.query("SELECT mc.id,mc.channel_kind,mc.page_name,mc.external_page_id,mc.status FROM meta_connections mc JOIN visitors v ON v.workspace_id=mc.workspace_id AND v.channel_id=mc.channel_id AND (($4::uuid IS NOT NULL AND mc.id=$4) OR ($4::uuid IS NULL AND v.token_hash='meta:'||mc.id::text||':'||(v.profile->>'metaUserId'))) WHERE v.id=$1 AND mc.workspace_id=$2 AND mc.channel_id=$3 ORDER BY (mc.id=$4) DESC,mc.created_at ASC,mc.id ASC LIMIT 1",[c.visitor_id,a.workspace_id,c.channel_id,c.connection_id])).rows[0];
  const prof=visitorRow?.profile||{};
  const name=prof.fullName?.trim()||prof.name?.trim()||'Khách vãng lai';
  const email=prof.emailAddress?.trim()||prof.email?.trim()||'';
  const phone=prof.phoneNumber?.trim()||prof.phone?.trim()||'';
  const company=prof.company?.trim()||'';

  let uiStatus:'handoff'|'ai_active'|'in_review'|'resolved'='ai_active';
  if(c.status==='resolved')uiStatus='resolved';
  else if(c.reply_owner==='HANDOFF_PENDING')uiStatus='handoff';
  else if(c.reply_owner==='HUMAN_ACTIVE')uiStatus='in_review';

  const avatar=`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`;

  return {
    id:c.id,
    connectionId:source?.id||null,
    platform:source?.channel_kind||null,
    accountName:source?.page_name||null,
    externalAccountId:source?.external_page_id||null,
    connectionStatus:source?.status||null,
    sourceLabel:source?.channel_kind&&source?.page_name?`${metaPlatformLabel(source.channel_kind)} · ${source.page_name}`:null,
    customerName:name,
    customerCompany:company,
    customerEmail:email,
    customerPhone:phone,
    customerLocation:prof.location||'',
    customerAvatar:prof.avatarUrl||avatar,
    clientTier:prof.clientTier||'',
    websiteUrl:channelRow?.channel_kind?'':channelRow?.origin||'',
    lastMessageSnippet:messages[messages.length-1]?.content||'Bắt đầu cuộc trò chuyện...',
    lastMessageTime:'1m ago',
    channel:channelRow?.channel_kind==='facebook_messenger'?'Facebook Messenger':channelRow?.channel_kind==='instagram_messaging'?'Instagram':channelRow?.channel_kind==='whatsapp_business'?'WhatsApp':channelRow?.channel_kind==='threads'?'Threads':channelRow?.widget_mode==='slack'?'Slack App':channelRow?.widget_mode==='email'?'Email':'Widget',
    status:uiStatus,
    assignedTo:c.assigned_to||undefined,
    ownerVersion:c.owner_version,
    activeUrl:prof.activeUrl||'',
    sessionDuration:prof.sessionDuration||'',
    deviceInfo:prof.deviceInfo||'',
    ragMatchScore:'',
    ragCitations:[],
    crmTags:conversationTags.length?conversationTags:(Array.isArray(prof.crmTags)?prof.crmTags:[]),
    messages:messages
  };
}

export async function setConversationTags(db:PoolClient,a:Actor,id:string,body:unknown){
 await access(db,a,id);
 const data=z.object({tags:z.array(z.string().trim().min(1).max(80)).max(30)}).strict().parse(body);
 const tags=[...new Set(data.tags)].sort((x,y)=>x.localeCompare(y));
 await db.query('DELETE FROM conversation_tags WHERE workspace_id=$1 AND conversation_id=$2',[a.workspace_id,id]);
 for(const tag of tags) await db.query('INSERT INTO conversation_tags(workspace_id,conversation_id,name) VALUES($1,$2,$3)',[a.workspace_id,id,tag]);
 await audit(db,a.workspace_id,a.user_id,'conversation.tags_updated',id);
 return {tags};
}

export async function inboxTyping(db:PoolClient,a:Actor,id:string,body:unknown){
  await access(db,a,id);
  const data=z.object({isTyping:z.boolean()}).parse(body);
  realtimeHub.broadcastToConversation(id,'typing',{
    conversationId:id,
    actorId:a.user_id,
    actorType:'agent',
    isTyping:data.isTyping,
    timestamp:new Date().toISOString(),
  });
  return {success:true};
}
