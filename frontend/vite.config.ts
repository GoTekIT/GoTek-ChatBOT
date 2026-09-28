import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@api': fileURLToPath(new URL('./src/api/api', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@screens': fileURLToPath(new URL('./src/screens', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
      },
      '/widget-api': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
      },
      '/widget.js': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
      },
      '/sdk.js': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
