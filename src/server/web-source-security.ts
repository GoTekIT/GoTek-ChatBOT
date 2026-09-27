import {BlockList,isIP} from 'node:net';
import {HttpError} from './security';
export type ResolveHost=(host:string)=>Promise<string[]>;
export const defaultResolveHost:ResolveHost=async(host)=>{const dns=await import('node:dns/promises');return (await dns.lookup(host,{all:true})).map(x=>x.address);};
const blockedV4=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]] as const)blockedV4.addSubnet(address,prefix,'ipv4');
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
const blockedV6=new BlockList();
for(const [address,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]] as const)blockedV6.addSubnet(address,prefix,'ipv6');
function blockedIp(ip:string){
 const family=isIP(ip);
 if(family===4)return blockedV4.check(ip,'ipv4');
 // Conservative global-unicast policy rejects mapped, transition, local and malformed addresses.
 if(family===6)return !globalV6.check(ip,'ipv6')||blockedV6.check(ip,'ipv6');
 return true;
}
export async function resolveWebSourceTarget(raw:string,resolve:ResolveHost=defaultResolveHost){let u:URL;try{u=new URL(raw);}catch{throw new HttpError(400,'INVALID_SOURCE_URL');}const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash||!host)throw new HttpError(400,'INVALID_SOURCE_URL');if(host==='localhost'||host.endsWith('.localhost')||host==='metadata.google.internal')throw new HttpError(400,'SSRF_BLOCKED');let addresses:string[];try{addresses=isIP(host)?[host]:await resolve(host);}catch{throw new HttpError(400,'SOURCE_DNS_FAILED');}if(!addresses.length||addresses.some(blockedIp))throw new HttpError(400,'SSRF_BLOCKED');return {url:u.origin+u.pathname+u.search,addresses};}
// Redirects must retain the initial origin, including transport and effective port.
export async function validateRedirectTarget(raw:string,originalUrl:string,resolve:ResolveHost=defaultResolveHost){
 let initial:URL,target:URL;
 try{initial=new URL(originalUrl);target=new URL(raw,initial);}catch{throw new HttpError(400,'INVALID_SOURCE_URL');}
 if(!['http:','https:'].includes(initial.protocol)||initial.username||initial.password||initial.hash)throw new HttpError(400,'INVALID_SOURCE_URL');
 if(target.origin!==initial.origin)throw new HttpError(400,'REDIRECT_ORIGIN_BLOCKED');
 return validateWebSourceUrl(target.href,resolve);
}

export async function validateWebSourceUrl(raw:string,resolve:ResolveHost=defaultResolveHost){return (await resolveWebSourceTarget(raw,resolve)).url;}

/** Provider endpoints are server-side egress targets: HTTPS only, no credentials/fragments,
 * and every resolved address must be globally routable. The resolved-address check is
 * repeated immediately before transport so DNS rebinding cannot bypass creation-time checks. */
export async function resolveProviderTarget(raw:string,resolve:ResolveHost=defaultResolveHost){
 const target=await resolveWebSourceTarget(raw,resolve);
 if(!target.url.startsWith('https://'))throw new HttpError(400,'PROVIDER_HTTPS_REQUIRED');
 return target;
}
export async function validateProviderUrl(raw:string,resolve:ResolveHost=defaultResolveHost){return (await resolveProviderTarget(raw,resolve)).url;}
