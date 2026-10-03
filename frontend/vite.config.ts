import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({mode}) => {
  const rootEnv = loadEnv(mode, fileURLToPath(new URL('../', import.meta.url)), ['GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID']);
  const frontendEnv = loadEnv(mode, fileURLToPath(new URL('./', import.meta.url)), 'VITE_GOOGLE_CLIENT_ID');
  // Expose only the public client ID, never backend secrets. Preserve frontend/.env.
  const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || frontendEnv.VITE_GOOGLE_CLIENT_ID
    || rootEnv.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || rootEnv.GOOGLE_CLIENT_ID || '';
  return {
  define: {'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId)},
  plugins: [react(), tailwindcss()],
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
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4317',
        changeOrigin: true,
      },
      '/meta': {
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
      '/ws': {
        target: 'ws://127.0.0.1:4317',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          three: ['three'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  };
});
