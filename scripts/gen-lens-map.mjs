// Writes src/assets/lens-map.png: the loupe's displacement map (R/G = x/y displacement, 128 = none).
// Generated once at build time instead of on a canvas at runtime (that cost ~0.5 s on the first
// table step in a software-rendered browser). Pure Node: a hand-written PNG encoder, no dependencies.
// Usage: node scripts/gen-lens-map.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 96;
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
const h = SIZE / 2;
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;                       // filter type: none
  for (let x = 0; x < SIZE; x++) {
    const dx = (x + 0.5 - h) / h, dy = (y + 0.5 - h) / h;
    const d = Math.hypot(dx, dy);
    let k = 0;
    if (d < 1 && d > 0.62) { const t = (d - 0.62) / 0.38; k = t * t * (3 - 2 * t); }   // smoothstep across the rim
    const i = y * (SIZE * 4 + 1) + 1 + x * 4;
    raw[i] = 128 + Math.round((d ? dx / d : 0) * k * 127);
    raw[i + 1] = 128 + Math.round((d ? dy / d : 0) * k * 127);
    raw[i + 2] = 128;
    raw[i + 3] = 255;
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(new URL('../src/assets/lens-map.png', import.meta.url), png);
console.log(`lens-map.png: ${SIZE}×${SIZE}, ${png.length} bytes`);
