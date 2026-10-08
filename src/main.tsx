import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/hardware.css';
import './styles/figures.css';
import './styles/home.css';
import './styles/motion.css';
import App from './App.tsx';

// Errors that an error boundary already handled (the homepage specimen's fallback) are reported
// quietly; anything uncaught still reaches the console as an error.
createRoot(document.getElementById('root')!, {
  onCaughtError: (error) => console.warn('Recovered:', error instanceof Error ? error.message : error),
}).render(<StrictMode><App /></StrictMode>);
