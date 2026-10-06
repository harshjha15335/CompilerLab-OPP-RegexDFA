import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Browsers refuse ES-module scripts on file:// pages (origin "null"). Emitting ONE classic deferred
// script keeps dist/index.html openable by double-click with no server. The 3D intro is a second,
// separately built classic script (vite.intro.config.ts) that the app injects only when needed.
const portableHtml = (): Plugin => ({
  name: 'portable-html',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => html.replace(/<script type="module" crossorigin/g, '<script defer').replace(/ crossorigin/g, ''),
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), portableHtml()],
  build: {
    modulePreload: false,
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
