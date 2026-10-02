/** One version policy for Facebook Graph requests. Invalid overrides use the default. */
export function metaGraphVersion():string {
 const value=process.env.META_GRAPH_API_VERSION?.trim() || process.env.META_GRAPH_VERSION?.trim() || 'v25.0';
 return /^v\d+\.\d+$/.test(value)?value:'v25.0';
}
