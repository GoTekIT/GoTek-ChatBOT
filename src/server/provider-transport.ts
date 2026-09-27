import {resolveProviderTarget,type ResolveHost} from './web-source-security';
/** Server-side inference transport shared by platform chat and workspace workers. */
export interface ProviderTransportOptions {
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  /** Injected only by deterministic tests; production uses DNS resolution. */
  resolveHost?: ResolveHost;
}
export type ProviderUsageMetadata = Readonly<{promptTokens?: number; completionTokens?: number; totalTokens?: number}>;
export type ProviderResult = Readonly<{text: string; usage?: ProviderUsageMetadata}>;
export type EmbeddingResult = Readonly<{vector:number[]; model:string}>;

/** Provider embedding transport; secrets and endpoint details never enter the result. */
export async function invokeEmbedding(adapter:string,model:string,base:string|undefined|null,key:string,input:string,options:ProviderTransportOptions={}):Promise<EmbeddingResult>{
 if(!['openai','chatgpt','custom_llm','gemini'].includes(adapter))throw new Error('EMBEDDING_ADAPTER_UNSUPPORTED');
 if(adapter==='custom_llm'&&!base)throw new Error('EMBEDDING_ENDPOINT_REQUIRED');
 if(!input.trim()||input.length>120000||!model.trim()||!key)throw new Error('EMBEDDING_INPUT_INVALID');
 if(base && (!options.fetch || options.resolveHost)){try{const safe=await resolveProviderTarget(base,options.resolveHost);base=safe.url;}catch(error){throw new Error(error instanceof Error && 'code' in error ? String((error as any).code) : 'PROVIDER_ENDPOINT_INVALID');}}
 const url=(base||((adapter==='gemini')?'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':embedContent':'https://api.openai.com/v1/embeddings'));
 const headers:Record<string,string>={'content-type':'application/json'};
 let target=url,body:any;
 if(adapter==='gemini'){target+=(target.includes('?')?'&':'?')+'key='+encodeURIComponent(key);body={model:`models/${model}`,content:{parts:[{text:input}]}};}
 else {headers.authorization=`Bearer ${key}`;body={model,input};}
 let response:Response;try{response=await(options.fetch||globalThis.fetch)(target,{method:'POST',redirect:'error',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(options.timeoutMs??30000)});}catch(e){if(e instanceof DOMException&&e.name==='TimeoutError')throw new Error('PROVIDER_TIMEOUT');throw new Error('PROVIDER_NETWORK_ERROR');}
 if(!response.ok)throw new Error(`PROVIDER_HTTP_${response.status}`);let data:any;try{data=await response.json();}catch{throw new Error('PROVIDER_INVALID_RESPONSE');}
 const vector=adapter==='gemini'?data?.embedding?.values:data?.data?.[0]?.embedding;
 if(!Array.isArray(vector)||!vector.length||vector.length>4096||vector.some((x:any)=>typeof x!=='number'||!Number.isFinite(x))||vector.every((x:number)=>x===0))throw new Error('PROVIDER_INVALID_EMBEDDING');
 return {vector,model};
}

export async function invokeProvider(
  adapter: string,
  model: string,
  base: string | undefined | null,
  key: string,
  message: string,
  options: ProviderTransportOptions = {},
): Promise<string> {
  return (await invokeProviderDetailed(adapter, model, base, key, message, options)).text;
}

/** Same transport with usage metadata retained for the metering boundary. */
export async function invokeProviderDetailed(
  adapter: string, model: string, base: string | undefined | null, key: string, message: string,
  options: ProviderTransportOptions = {},
): Promise<ProviderResult> {
  if (!['gemini','anthropic','claude_code','openai','chatgpt','custom_llm'].includes(adapter)) throw new Error('PROVIDER_ADAPTER_UNSUPPORTED');
  if (adapter === 'custom_llm' && !base?.trim()) throw new Error('PROVIDER_ENDPOINT_REQUIRED');
  if(base && (!options.fetch || options.resolveHost)){try{const safe=await resolveProviderTarget(base,options.resolveHost);base=safe.url;}catch(error){throw new Error(error instanceof Error && 'code' in error ? String((error as any).code) : 'PROVIDER_ENDPOINT_INVALID');}}
  const headers: Record<string, string> = {'content-type': 'application/json'};
  let url = base || '';
  let body: unknown;
  if (adapter === 'gemini') {
    url ||= `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    url += (url.includes('?') ? '&key=' : '?key=') + encodeURIComponent(key);
    body = {contents: [{parts: [{text: message}]}]};
  } else if (adapter === 'anthropic' || adapter === 'claude_code') {
    url ||= 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
    body = {model, max_tokens: 2000, messages: [{role: 'user', content: message}]};
  } else {
    url ||= 'https://api.openai.com/v1/chat/completions';
    headers.authorization = `Bearer ${key}`;
    body = {model, messages: [{role: 'user', content: message}]};
  }
  let response: Response;
  try {
    response = await (options.fetch || globalThis.fetch)(url, {
      method: 'POST', redirect: 'error', headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    });
  } catch (error) {
    // Never bubble a provider URL, key, or transport implementation detail into
    // the job/audit boundary. Callers can classify these stable codes.
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('PROVIDER_TIMEOUT');
    if (error instanceof Error && error.name === 'AbortError') throw new Error('PROVIDER_TIMEOUT');
    throw new Error('PROVIDER_NETWORK_ERROR');
  }
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
  let data: any;
  try { data = await response.json(); }
  catch { throw new Error('PROVIDER_INVALID_RESPONSE'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('PROVIDER_INVALID_RESPONSE');
  if (adapter === 'gemini' && data.candidates !== undefined && !Array.isArray(data.candidates)) throw new Error('PROVIDER_INVALID_RESPONSE');
  const geminiParts = adapter === 'gemini' ? data.candidates?.[0]?.content?.parts : undefined;
  if (geminiParts !== undefined && !Array.isArray(geminiParts)) throw new Error('PROVIDER_INVALID_RESPONSE');
  if ((adapter === 'anthropic' || adapter === 'claude_code') && data.content !== undefined && !Array.isArray(data.content)) throw new Error('PROVIDER_INVALID_RESPONSE');
  const output = adapter === 'gemini'
    ? geminiParts?.filter((p: any) => p && typeof p.text === 'string').map((p: any) => p.text).join('\n')
    : adapter === 'anthropic' || adapter === 'claude_code'
      ? data.content?.filter((p: any) => p && p.type === 'text' && typeof p.text === 'string').map((p: any) => p.text).join('\n')
      : data.choices?.[0]?.message?.content;
  if (typeof output !== 'string' || !output.trim()) throw new Error('PROVIDER_EMPTY_RESPONSE');
  const usage = data.usage ?? data.usageMetadata;
  if (!usage || typeof usage !== 'object') return {text:output};
  const mapped = {
    promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? usage.inputTokenCount,
    completionTokens: usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? usage.outputTokenCount,
    totalTokens: usage.total_tokens ?? usage.totalTokenCount,
  };
  return {text:output,usage:Object.fromEntries(Object.entries(mapped).filter(([,value])=>value!==undefined))};
}
