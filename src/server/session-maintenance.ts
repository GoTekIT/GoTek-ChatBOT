import type {PoolClient} from 'pg';

/**
 * Remove expired user sessions in bounded batches.  This is deliberately a
 * maintenance primitive rather than part of request authentication: expired
 * rows are already rejected by identity(), while this keeps the identity
 * table from growing without bound.  FOR UPDATE SKIP LOCKED lets multiple
 * maintenance workers run safely without waiting on one another.
 */
export async function purgeExpiredSessions(db:PoolClient, batchSize=500):Promise<number>{
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>5000)throw new Error('INVALID_BATCH_SIZE');
 let removed=0;
 for(;;){
  const result=await db.query(`
   WITH expired AS (
    SELECT token_hash FROM sessions
    WHERE expires_at<=clock_timestamp()
    ORDER BY expires_at,token_hash
    FOR UPDATE SKIP LOCKED
    LIMIT $1
   )
   DELETE FROM sessions s USING expired e
   WHERE s.token_hash=e.token_hash
   RETURNING s.token_hash`,[batchSize]);
  removed+=result.rowCount||0;
  if((result.rowCount||0)<batchSize)return removed;
 }
}
