import express from 'express';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import http from 'node:http';
import {createApp} from './app.js';
import {getRabbitChannel} from './core/rabbitmq.js';
import {startNotificationWorker} from './workers/notification.worker.js';
import {startAiWorker} from './workers/ai.worker.js';
import {initWebSocketServer} from './modules/chat/websocket.js';

const app = createApp();
const server = http.createServer(app);

// Initialize Full-Duplex 2-Way WebSocket Server
initWebSocketServer(server);

const port = Number(process.env.PORT) || 4317;
const host = process.env.HOST || '127.0.0.1';

// Serve public static assets (sdk.js, logo, etc.)
app.use(express.static(resolve('public'), {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Optional: serve static frontend if build exists
const frontendDist = resolve('../frontend/dist');
const localDist = resolve('dist');
const targetDist = existsSync(frontendDist) ? frontendDist : (existsSync(localDist) ? localDist : null);

if (process.env.SERVE_BUILD === 'true' && targetDist) {
  app.use(express.static(targetDist));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(targetDist, 'index.html')));
}

server.listen(port, host, () => {
  console.log(`GoTek Chatbot Backend & WebSocket running: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port} (WS on /ws)`);
  // Initialize message broker queues and workers in background
  void getRabbitChannel().then(() => {
    void startNotificationWorker();
    void startAiWorker();
  });
});
