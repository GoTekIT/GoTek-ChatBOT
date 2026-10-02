import {Router} from 'express';
import {listInboxSources} from '../modules/meta/connections';
import {authed, identity, Identity} from '../middlewares/auth.middleware';
import {transaction} from '../core/db';
import {uuid} from '../core/security';
import {realtimeHub} from '../modules/chat/realtime';
import {
  inboxResumeAi,
  inboxList,
  inboxMessages,
  inboxDetail,
  inboxAssign,
  inboxTakeover,
  inboxSend,
  inboxSetStatus,
  inboxTyping,
  setConversationTags,
  access
} from '../modules/chat/inbox';

export const inboxRouter = Router();
inboxRouter.get('/inbox/sources',authed((db,i)=>listInboxSources(db,i)));

inboxRouter.get(
  '/conversations',
  authed((db, i, req) => inboxList(db, i, req.query))
);

inboxRouter.get(
  '/conversations/:id',
  authed((db, i, req) => inboxDetail(db, i, String(req.params.id)))
);

inboxRouter.get(
  '/conversations/:id/messages',
  authed((db, i, req) => inboxMessages(db, i, String(req.params.id), req.query.after))
);
inboxRouter.put('/conversations/:id/tags',authed((db,i,req)=>setConversationTags(db,i,String(req.params.id),req.body)));

inboxRouter.post(
  '/conversations/:id/assign',
  authed((db, i, req) => inboxAssign(db, i, String(req.params.id), req.body))
);

inboxRouter.post(
  '/conversations/:id/resume-ai',
  authed((db, i, req) => inboxResumeAi(db, i, String(req.params.id), req.body))
);

inboxRouter.post(
  '/conversations/:id/takeover',
  authed((db, i, req) => inboxTakeover(db, i, String(req.params.id), req.body))
);

inboxRouter.post(
  '/conversations/:id/messages',
  async (req,res,next) => {
    const afterCommit:Array<()=>void>=[];
    try {
      const message=await transaction(async db=>{
        const actor=await identity(db,req);
        return inboxSend(db,actor,String(req.params.id),req.body,afterCommit);
      });
      for(const publish of afterCommit){try{publish();}catch{console.warn('INBOX_REALTIME_PUBLISH_FAILED');}}
      res.json(message);
    }catch(error){next(error);}
  }
);

inboxRouter.patch(
  '/conversations/:id/status',
  authed((db, i, req) => inboxSetStatus(db, i, String(req.params.id), req.body))
);

inboxRouter.post(
  '/conversations/:id/typing',
  authed((db, i, req) => inboxTyping(db, i, String(req.params.id), req.body))
);

inboxRouter.post(
  '/inbox/conversations/:id/typing',
  authed((db, i, req) => inboxTyping(db, i, String(req.params.id), req.body))
);

/**
 * Realtime Server-Sent Events (SSE) Stream for a single conversation.
 * Streams: message:new, typing, conversation:takeover, conversation:status, ai:token
 */
const conversationStreamHandler = async (req: any, res: any, next: any) => {
  try {
    let actor: Identity;
    await transaction(async db => {
      actor = await identity(db, req);
      await access(db, actor, String(req.params.id));
    });
    realtimeHub.register(uuid(), actor!.workspace_id, res, req, String(req.params.id));
  } catch (e) {
    next(e);
  }
};

inboxRouter.get('/conversations/:id/stream', conversationStreamHandler);
inboxRouter.get('/inbox/conversations/:id/stream', conversationStreamHandler);

/**
 * Realtime Server-Sent Events (SSE) Stream for the whole workspace inbox.
 * Streams: inbox:message_sent, inbox:takeover, inbox:status_changed, inbox:ai_resumed
 */
inboxRouter.get('/stream', async (req, res, next) => {
  try {
    let actor: Identity;
    await transaction(async db => {
      actor = await identity(db, req);
    });
    realtimeHub.register(uuid(), actor!.workspace_id, res, req);
  } catch (e) {
    next(e);
  }
});
