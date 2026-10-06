import { defineConfig } from 'vite';

// The first-visit 3D intro: three.js + the scene, as one classic IIFE script at dist/assets/intro.js.
// Built after the app (emptyOutDir: false) and loaded at runtime with a <script> tag, so it stays
// out of the main bundle and works from file://.
export default defineConfig({
  base: './',
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist/assets',
    emptyOutDir: false,
    target: 'es2022',
    copyPublicDir: false,
    chunkSizeWarningLimit: 600,
    lib: { entry: 'src/intro/three-intro.ts', formats: ['iife'], name: 'CompilerLabIntroBundle', fileName: () => 'intro.js' },
  },
});
