import {HttpError} from '../../core/security';

/** Only provider-returned display data; contact details are never inferred. */
export async function fetchMetaProfile(userId:string,tokenRef:string,fetchImpl:typeof fetch=fetch){
 const token=process.env[tokenRef];
 if(!token)throw new HttpError(503,'META_TOKEN_NOT_CONFIGURED');
 const url=new URL(`https://graph.facebook.com/v26.0/${encodeURIComponent(userId)}`);
 url.searchParams.set('fields','first_name,last_name,profile_pic');
 const response=await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new HttpError(502,'META_PROFILE_UNAVAILABLE');
 const body=await response.json() as Record<string,unknown>;
 const name=[body.first_name,body.last_name].filter((v):v is string=>typeof v==='string').join(' ').trim();
 const profile:Record<string,string>={};
 if(name)profile.name=name.slice(0,300);
 if(typeof body.profile_pic==='string'){
  try{const avatar=new URL(body.profile_pic);if(avatar.protocol==='https:')profile.avatarUrl=avatar.href;}catch{}
 }
 return profile;
}
