import { createRoot } from 'react-dom/client';
// Local, Vite-bundled font files (no CDN, no runtime network fetch).
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
