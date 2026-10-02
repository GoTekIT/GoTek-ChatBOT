import {createHash} from 'node:crypto';
import {normalizeMetaStatuses,normalizeMetaInbound} from './inbound';

/** Reinterpret retained raw Facebook messages using the current parser.
 * Routing and event identity must match the immutable ingress envelope.
 */
export function normalizeRetainedFacebookMessage(row:{surface:string;external_account_id:string;external_event_id:string;payload:unknown}) {
 if(row.surface!=='facebook_messenger')return undefined;
 const events=normalizeMetaInbound({object:'page',entry:[{id:row.external_account_id,messaging:[row.payload]}]});
 if(events.length!==1)return undefined;
 const event=events[0];
 if(event.externalAccountId!==row.external_account_id||event.eventId!==row.external_event_id)return undefined;
 return event;
}

/** Recover only retained raw status envelopes with their original immutable key. */
export function normalizeRetainedFacebookStatuses(row:{surface:string;external_account_id:string;external_event_id:string;payload:unknown}){
 if(row.surface!=='facebook_messenger')return [];
 const statuses=normalizeMetaStatuses({object:'page',entry:[{id:row.external_account_id,messaging:[row.payload]}]});
 if(!statuses.length)return [];
 const hash=createHash('sha256').update(`${row.surface}:${row.external_account_id}:${JSON.stringify(row.payload)}`).digest('hex');
 if(row.external_event_id!==hash&&!statuses.some(status=>status.eventId===row.external_event_id))return [];
 return statuses.every(status=>status.externalAccountId===row.external_account_id)?statuses:[];
}
