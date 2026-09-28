import express from 'express';
import {resolve} from 'node:path';
import {createApp} from './app';

const app = createApp();

if (process.env.NODE_ENV === 'production') {
  throw new Error('Production is not approved. Use local/test environment.');
}

const port = Number(process.env.PORT) || 4317;
const host = process.env.HOST || '127.0.0.1';

if (process.env.SERVE_BUILD === 'true') {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const {createServer} = await import('vite');
  const vite = await createServer({
    server: {middlewareMode: true},
    appType: 'spa'
  });
  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  console.log(`GoTek local/test running: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
});
