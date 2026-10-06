// Zero-dependency static server for the production build (optional: dist/index.html also
// opens directly by double-click). Usage: node scripts/serve-dist.mjs [port] [folder]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2]) || 4173;
const root = resolve(process.argv[3] || 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.json': 'application/json' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/])+/, '');
  const file = resolve(join(root, path || 'index.html'));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file.endsWith('\\') || file.endsWith('/') ? join(file, 'index.html') : file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`ParseLens build served at http://127.0.0.1:${port}/`));
