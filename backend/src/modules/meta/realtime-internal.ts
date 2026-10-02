import type {Request,Response} from 'express';
import {transaction,scope} from '../../core/db';
import {realtimeHub} from '../chat/realtime';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function notifyMetaRealtime(req:Request,res:Response){
 const expected=process.env.META_REALTIME_INTERNAL_SECRET;
 if(!expected||req.get('x-gotek-worker-secret')!==expected)return res.status(404).end();
 const body=req.body as {workspaceId?:unknown;connectionId?:unknown};
 if(typeof body?.workspaceId!=='string'||typeof body.connectionId!=='string'||!UUID.test(body.workspaceId)||!UUID.test(body.connectionId))return res.status(400).end();
 const channelId=await transaction(async db=>{await scope(db,body.workspaceId as string);return (await db.query('SELECT channel_id FROM meta_connections WHERE workspace_id=$1 AND id=$2',[body.workspaceId,body.connectionId])).rows[0]?.channel_id as string|undefined;});
 if(!channelId)return res.status(404).end();
 realtimeHub.broadcastToWorkspace(body.workspaceId as string,'inbox:refresh',{connectionId:body.connectionId,source:'meta',realtime:true,updatedAt:new Date().toISOString()},{channelId});
 return res.status(204).end();
}
