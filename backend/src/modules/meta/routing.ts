import {z} from 'zod';
import {HttpError} from '../../core/security';
import type {MetaSurface} from './connectors';

const routeSchema=z.object({
 surface:z.enum(['facebook_messenger','instagram_messaging','whatsapp_business']),
 externalAccountId:z.string().min(1).max(128),
 workspaceId:z.string().uuid(),
 connectionId:z.string().uuid(),
}).strict();
export type MetaPilotRoute=z.infer<typeof routeSchema>;

/** Operator-owned configuration only. Never pass webhook-supplied configuration here.
 * Account IDs are Page ID, Instagram account ID, or WhatsApp phone_number_id.
 */
export function parseMetaPilotRoutes(config:string|undefined):MetaPilotRoute[]{
 if(!config)return [];
 try{
  const routes=z.array(routeSchema).max(100).parse(JSON.parse(config));
  const seen=new Set<string>();
  for(const route of routes){
   const key=JSON.stringify([route.surface,route.externalAccountId]);
   if(seen.has(key))throw new Error('duplicate route');
   seen.add(key);
  }
  return routes;
 }catch{throw new HttpError(503,'META_ROUTING_INVALID');}
}
export function resolveMetaPilotRoute(routes:readonly MetaPilotRoute[],surface:MetaSurface,externalAccountId:string):MetaPilotRoute|undefined{
 return routes.find(route=>route.surface===surface&&route.externalAccountId===externalAccountId);
}
