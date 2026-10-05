import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Browsers refuse ES-module scripts and `crossorigin` assets on file:// pages. Emitting one
// classic deferred script keeps dist/index.html openable by double-click, with no server.
const portableHtml = () => ({
  name: 'portable-html',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html
      .replace(/<script type="module" crossorigin/g, '<script defer')
      .replace(/ crossorigin/g, ''),
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), portableHtml()],
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { format: 'iife' } },
  },
});
