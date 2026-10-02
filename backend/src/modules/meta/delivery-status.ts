/** Provider evidence takes precedence over local dispatcher settlement. */
export function metaDeliveryStatus(receipt: string | null | undefined, job: string | null | undefined): string {
 if(receipt)return receipt;
 if(job==='dead'||job==='cancelled')return 'failed';
 if(job==='unknown'||job==='succeeded')return 'unknown';
 return 'queued';
}
