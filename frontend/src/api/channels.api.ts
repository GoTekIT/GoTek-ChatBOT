import {api} from './api';

export type ChannelRow = {id:string;name:string;origin:string;greeting:string;color:string;enabled:boolean};
export type InstallSnippet = {id:string;name:string;snippet:string;origin:string};
export type CreateChannelInput = {requestId:string;name:string;origin:string;greeting:string;color:string;agents:string[]};
export const channelsApi = {
  list: () => api('/channels') as Promise<ChannelRow[]>,
  setEnabled: (id:string, enabled:boolean) => api(`/channels/${id}/state`,'PATCH',{enabled}),
  installation: (id:string) => api(`/channels/${id}/installation`) as Promise<InstallSnippet>,
  create: (input:CreateChannelInput) => api('/channels','POST',input),
};
