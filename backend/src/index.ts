import express from 'express';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {createApp} from './app.js';
import {getRabbitChannel} from './core/rabbitmq.js';
import {startNotificationWorker} from './workers/notification.worker.js';

const app = createApp();

const port = Number(process.env.PORT) || 4317;
const host = process.env.HOST || '127.0.0.1';

// Serve public static assets (sdk.js, logo, etc.)
app.use(express.static(resolve('public')));

// Optional: serve static frontend if build exists
const frontendDist = resolve('../frontend/dist');
const localDist = resolve('dist');
const targetDist = existsSync(frontendDist) ? frontendDist : (existsSync(localDist) ? localDist : null);

if (process.env.SERVE_BUILD === 'true' && targetDist) {
  app.use(express.static(targetDist));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(targetDist, 'index.html')));
}

app.listen(port, host, () => {
  console.log(`GoTek Chatbot Backend running: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
  // Initialize message broker queues and workers in background
  void getRabbitChannel().then(() => {
    void startNotificationWorker();
  });
});
