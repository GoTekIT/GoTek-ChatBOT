/** Supported Meta surfaces and the transport contract used by the inbox.
 *
 * This is deliberately metadata-only: credentials and provider calls stay in
 * the existing connection/worker path. A catalog entry does not claim that a
 * Meta product is live or App-Review approved.
 */
export type MetaSurface = 'facebook_messenger'|'instagram_messaging'|'whatsapp_business'|'threads';
export type MetaConnectorStatus = 'pilot_ready'|'credentials_required'|'api_limited';

export type MetaConnector = {
  surface: MetaSurface;
  label: string;
  channelKind: MetaSurface;
  inboundWebhook: boolean;
  outboundMessaging: boolean;
  profileFields: readonly string[];
  status: MetaConnectorStatus;
};

export const META_CONNECTORS: readonly MetaConnector[] = [
  {surface:'facebook_messenger',label:'Facebook Messenger',channelKind:'facebook_messenger',inboundWebhook:true,outboundMessaging:true,profileFields:['name','avatar','external_user_id'],status:'pilot_ready'},
  {surface:'instagram_messaging',label:'Instagram Direct',channelKind:'instagram_messaging',inboundWebhook:true,outboundMessaging:true,profileFields:['name','avatar','external_user_id'],status:'credentials_required'},
  {surface:'whatsapp_business',label:'WhatsApp Business',channelKind:'whatsapp_business',inboundWebhook:true,outboundMessaging:true,profileFields:['name','phone','external_user_id'],status:'credentials_required'},
  // Threads has public APIs, but this product must not present it as a DM
  // connector until Meta exposes and GoTek verifies an approved messaging API.
  {surface:'threads',label:'Threads',channelKind:'threads',inboundWebhook:false,outboundMessaging:false,profileFields:['external_user_id'],status:'api_limited'},
];

export function getMetaConnector(surface: string): MetaConnector|undefined {
  return META_CONNECTORS.find((connector) => connector.surface === surface);
}
