// Shared Chromium launcher for the verification scripts (Playwright core, no browser download).
// Finds a local Chromium/Chrome/Edge; CHROME_PATH overrides. Adds --no-sandbox only when running
// as root (containers), and SwiftShader flags so WebGL works on machines without a GPU.
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function findChrome() {
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const fromPw = existsSync(pw)
    ? readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse().map((d) => join(pw, d, 'chrome-linux', 'chrome'))
    : [];
  return [process.env.CHROME_PATH, ...fromPw,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && existsSync(p));
}

// compositing: 'gl' renders everything through ANGLE/SwiftShader so WebGL works without a GPU (used for
// the intro). 'software' uses Chrome's own software compositor, which is what a GPU-less machine gets for
// page compositing; frame-rate checks use it, because emulated-GL compositing redraws the whole viewport
// on the CPU every animated frame (measured: 17/170 long frames vs 4/236 on the same page).
export async function launch({ webgl = true, compositing = 'gl' } = {}) {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('No Chromium-based browser found. Set CHROME_PATH.');
  const args = compositing === 'software' ? ['--disable-gpu-compositing'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
  if (typeof process.getuid === 'function' && process.getuid() === 0) args.push('--no-sandbox');
  if (!webgl) args.push('--disable-webgl', '--disable-3d-apis');
  return chromium.launch({ executablePath, args });
}
