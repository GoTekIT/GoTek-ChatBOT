import {consumeTasks, QUEUES} from '../core/rabbitmq.js';
import {runAiWorkerOnce, defaultWorkspaceProviderInvoke} from '../modules/jobs/worker.js';

export interface AiReplyTask {
  workspace: string;
  kind: 'ai.reply';
  key: string;
  payload: {
    conversationId: string;
    messageId: string;
    ownerVersion: number;
    requireGrounded?: boolean;
  };
}

let isAiWorkerRunning = false;

/**
 * Event-driven AI Reply Worker consuming from RabbitMQ.
 * Falls back safely if message broker is unavailable.
 */
export async function startAiWorker(): Promise<void> {
  if (isAiWorkerRunning) return;
  isAiWorkerRunning = true;
  const invoke = defaultWorkspaceProviderInvoke();

  console.log(`[RabbitMQ][AI Worker] 🚀 Subscribing to queue: "${QUEUES.AI_REPLY}"`);

  await consumeTasks<AiReplyTask>(QUEUES.AI_REPLY, async (task) => {
    const start = Date.now();
    const convId = task.payload?.conversationId;
    console.log(`[RabbitMQ][AI Worker] 📥 Received "ai.reply" task for workspace: ${task.workspace}, conversation: ${convId}`);

    try {
      const result = await runAiWorkerOnce(task.workspace, invoke);
      const duration = Date.now() - start;
      console.log(`[RabbitMQ][AI Worker] ✅ Processed "ai.reply" in ${duration}ms (Outcome: ${result.state})`);
    } catch (err: any) {
      console.error(`[RabbitMQ][AI Worker] ❌ Task processing failed:`, err?.message || err);
      throw err; // Nack to allow RabbitMQ retry
    }
  });
}
