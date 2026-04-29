import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public/icon.svg');
const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });

const svg = readFileSync(src);

// Background colour matches the SVG canvas + manifest theme so the
// maskable safe-area padding is invisible.
const bg = { r: 0xe7, g: 0xe0, b: 0xd5, alpha: 1 };

// PNG, not JPEG: Chrome's PWA installability check is conservative
// about non-PNG icons and can silently fail to qualify a site as
// installable when icons come back as image/jpeg, which downgrades
// the user experience to "Add to Home Screen" (a bookmark) instead
// of the real "Install app" prompt.
async function emit(name, size, opts = {}) {
  const { padding = 0 } = opts;
  const inner = Math.round(size * (1 - padding * 2));
  const rendered = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: bg })
    .toBuffer();
  const buf = await sharp({
    create: { width: size, height: size, channels: 3, background: bg },
  })
    .composite([{ input: rendered, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(out, name), buf);
  console.log('wrote', name, buf.length, 'bytes');
}

await emit('icon-192.png', 192);
await emit('icon-512.png', 512);
await emit('apple-touch-icon.png', 180);
// Maskable variants: pad ~10% on each side so the central 80% safe-zone
// holds the glyph regardless of how the OS clips the icon.
await emit('icon-maskable-192.png', 192, { padding: 0.1 });
await emit('icon-maskable-512.png', 512, { padding: 0.1 });
