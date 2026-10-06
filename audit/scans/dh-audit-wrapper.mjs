// Audit-only wrapper around Design Harness (pinned 9a9e39b). Calls auditUrl + writeAuditArtifacts, nothing else.
// No loop, no agent command. Target must be 127.0.0.1; Chromium resolves every other host to NOTFOUND.
// Usage: node dh-audit.mjs <dh-dir> <outDir> <url> [<url>...]
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const [dh, outRoot, ...urls] = process.argv.slice(2);
const imp = (p) => import(pathToFileURL(join(dh, p)).href);
const { auditUrl } = await imp('packages/visual-audit/dist/index.js');
const { writeAuditArtifacts } = await imp('packages/cli/dist/output.js');
const { assertLocalHttpUrl } = await imp('packages/core/dist/input-policy.js');
const { chromium } = await import(pathToFileURL(join(dh, 'node_modules/.pnpm/node_modules/playwright/index.mjs')).href);
const presets = [
  { name: 'desktop-1440', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  { name: 'laptop-1280', width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false },
  { name: 'tablet-768', width: 768, height: 1024, deviceScaleFactor: 1, isMobile: true },
  { name: 'mobile-390', width: 390, height: 844, deviceScaleFactor: 1, isMobile: true },
  { name: 'mobile-360', width: 360, height: 800, deviceScaleFactor: 1, isMobile: true },
];
const launchBrowser = () => chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // contain the untrusted page: only 127.0.0.1 resolves
  // containment: no proxy (so host-resolver-rules apply to every request), only 127.0.0.1 resolves,
  // and Chromium's own background services (updates, safe browsing, etc.) are off
  args: ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings', '--disable-domain-reliability'],
});
for (const url of urls) {
  const u = new URL(url);
  if (u.hostname !== '127.0.0.1') throw new Error('refusing non-127.0.0.1 target');
  assertLocalHttpUrl(url);
  const outDir = join(outRoot, (u.hash.replace(/[#/?=]+/g, '_').replace(/^_|_$/g, '') || 'home'));
  const result = await auditUrl({ url, outDir, viewportPresets: presets, timeoutMs: 30000, launchBrowser });
  await writeAuditArtifacts({ outDir, auditResult: result.auditResult, metadata: result.metadata });
  console.log(`${url} -> ${result.auditResult.status} ${outDir}`);
}
