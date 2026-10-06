import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts are bundled by Vite from local packages: no CDN, no runtime network request.
import '@fontsource-variable/ibm-plex-sans/wght.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/hardware.css';
import './styles/figures.css';
import './styles/home.css';
import './styles/motion.css';
import { initGlyphs } from './ui/glyphs.ts';
import App from './App.tsx';

initGlyphs();
// Errors that an error boundary already handled (the homepage specimen's fallback) are reported
// quietly; anything uncaught still reaches the console as an error.
createRoot(document.getElementById('root')!, {
  onCaughtError: (error) => console.warn('Recovered:', error instanceof Error ? error.message : error),
}).render(<StrictMode><App /></StrictMode>);
