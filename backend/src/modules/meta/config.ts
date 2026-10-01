import {HttpError} from '../../core/security';
import type {MetaProvider} from './oauth-state';

export interface MetaConfig {
  provider: MetaProvider;
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphVersion: string;
  loginConfigId?: string;
}
/** Configuration is server-owned; no client-supplied callback or API origin. */
export function metaConfig(provider: MetaProvider, env: NodeJS.ProcessEnv = process.env): MetaConfig {
  const prefix = provider === 'facebook' ? 'META_FACEBOOK' : 'META_INSTAGRAM';
  const appId = env[`${prefix}_APP_ID`] || '';
  const appSecret = env[`${prefix}_APP_SECRET`] || '';
  const redirectUri = env[`${prefix}_REDIRECT_URI`] || '';
  const graphVersion = env.META_GRAPH_VERSION || '';
  const loginConfigId = env.META_FACEBOOK_LOGIN_CONFIG_ID;
  let validRedirect = false;
  try {
    const url = new URL(redirectUri);
    validRedirect = url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search;
  } catch { /* Fail closed below, without disclosing configuration. */ }
  if (!/^\d+$/.test(appId) || !appSecret || !validRedirect || !/^v\d+\.\d+$/.test(graphVersion)
      || (provider === 'facebook' && (!loginConfigId || !/^\d+$/.test(loginConfigId)))) {
    throw new HttpError(503, 'META_NOT_CONFIGURED');
  }
  return {provider, appId, appSecret, redirectUri, graphVersion, loginConfigId};
}

export function metaAuthorizationUrl(config: MetaConfig, state: string): string {
  const url = new URL(config.provider === 'facebook'
    ? `https://www.facebook.com/${config.graphVersion}/dialog/oauth`
    : 'https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (config.provider === 'facebook') {
    // Scopes/assets are configured in Meta's Facebook Login for Business configuration.
    url.searchParams.set('config_id', config.loginConfigId!);
  } else {
    url.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_messages');
  }
  return url.toString();
}
