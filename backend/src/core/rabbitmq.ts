import amqp, {type Channel, type ChannelModel} from 'amqplib';

export const QUEUES = {
  AI_REPLY: 'gotek.ai.reply',
  KNOWLEDGE_EMBED: 'gotek.knowledge.embed',
  WEB_CRAWL: 'gotek.web.crawl',
  NOTIFICATIONS: 'gotek.notifications'
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let isConnecting = false;

function resolveRabbitMqUrl(): string {
  if (process.env.RABBITMQ_URL) {
    return process.env.RABBITMQ_URL;
  }
  const host = process.env.RABBITMQ_HOST || '127.0.0.1';
  const port = Number(process.env.RABBITMQ_PORT) || 5672;
  const user = process.env.RABBITMQ_USER || 'guest';
  const pass = process.env.RABBITMQ_PASSWORD || 'guest';
  return `amqp://${user}:${pass}@${host}:${port}`;
}

export async function getRabbitChannel(): Promise<Channel | null> {
  if (channel) return channel;
  if (isConnecting) return null;

  try {
    isConnecting = true;
    const url = resolveRabbitMqUrl();
    const conn = await amqp.connect(url);
    connection = conn;

    conn.on('error', err => {
      console.warn('[RabbitMQ] Connection error:', err.message);
      channel = null;
      connection = null;
    });

    conn.on('close', () => {
      console.warn('[RabbitMQ] Connection closed, will reconnect on next call');
      channel = null;
      connection = null;
    });

    const ch = await conn.createChannel();
    channel = ch;

    // Assert standard durable task queues
    for (const q of Object.values(QUEUES)) {
      await ch.assertQueue(q, {
        durable: true
      });
    }

    console.log('[RabbitMQ] Connected and queues initialized successfully');
    return ch;
  } catch (err: any) {
    console.warn(`[RabbitMQ] Failed to connect to message broker: ${err.message}. (Workers can fallback to DB polling)`);
    channel = null;
    connection = null;
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * Publish task message to a durable queue
 */
export async function publishTask<T>(queueName: QueueName | string, message: T): Promise<boolean> {
  const ch = await getRabbitChannel();
  if (!ch) {
    console.warn(`[RabbitMQ] Channel unavailable, task not published to ${queueName}`);
    return false;
  }

  const payload = Buffer.from(JSON.stringify({
    ...message,
    _publishedAt: new Date().toISOString()
  }));

  return ch.sendToQueue(queueName, payload, {
    persistent: true,
    contentType: 'application/json'
  });
}

/**
 * Consume task messages from a queue with automatic ack/nack
 */
export async function consumeTasks<T>(
  queueName: QueueName | string,
  handler: (data: T) => Promise<void>
): Promise<void> {
  const ch = await getRabbitChannel();
  if (!ch) {
    console.warn(`[RabbitMQ] Channel unavailable, unable to consume from ${queueName}`);
    return;
  }

  await ch.prefetch(1);
  await ch.consume(queueName, async msg => {
    if (!msg) return;
    try {
      const data: T = JSON.parse(msg.content.toString('utf8'));
      await handler(data);
      ch.ack(msg);
    } catch (err) {
      console.error(`[RabbitMQ] Error processing task in ${queueName}:`, err);
      // Requeue once if not previously delivered, otherwise reject to DLQ
      ch.nack(msg, false, !msg.fields.redelivered);
    }
  });
}

/**
 * Gracefully close connections
 */
export async function closeRabbitMQ(): Promise<void> {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch {
    // Ignore close errors on shutdown
  } finally {
    channel = null;
    connection = null;
  }
}
