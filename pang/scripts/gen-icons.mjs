import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/icons');
mkdirSync(out, { recursive: true });

// Two source SVGs:
//   • icon.svg            — the splat glyph alone. Used for the browser
//                           tab favicon where 16–32 px reads as a clean
//                           silhouette.
//   • pang-logo.svg       — the PANG wordmark. Used for the PWA install
//                           icon + maskable variants, so the Android
//                           home-screen icon and boot splash both show
//                           the brand the user recognises (matches
//                           beat 1 of our splash animation).
const splatSvg = readFileSync(join(root, 'public/icon.svg'));
const wordmarkSvg = readFileSync(join(root, 'public/pang-logo.svg'));

// PWA-icon background — beige, matches the manifest's background_color
// so the maskable safe-area padding is invisible.
const bg = { r: 0xe7, g: 0xe0, b: 0xd5, alpha: 1 };

// PNG, not JPEG: Chrome's PWA installability check rejects JPEG icons
// silently and downgrades sites to "Add to Home Screen" (a bookmark)
// instead of the real "Install app" prompt.
async function emit(name, size, opts = {}) {
  const { padding = 0, source = wordmarkSvg, transparent = false } = opts;
  const inner = Math.round(size * (1 - padding * 2));
  const rendered = await sharp(source, { density: 384 })
    .resize(inner, inner, {
      fit: 'contain',
      background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : bg,
    })
    .toBuffer();
  const base = transparent
    ? sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
    : sharp({
        create: { width: size, height: size, channels: 3, background: bg },
      });
  const buf = await base
    .composite([{ input: rendered, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(out, name), buf);
  console.log('wrote', name, buf.length, 'bytes');
}

// "any" purpose: PANG wordmark on beige. Slight inner padding so the
// wordmark doesn't kiss the icon edges on round Android masks.
await emit('icon-192.png', 192, { padding: 0.08 });
await emit('icon-512.png', 512, { padding: 0.08 });
await emit('apple-touch-icon.png', 180, { padding: 0.08 });

// Maskable: 10% safe-area padding so the central 80% holds the wordmark
// regardless of how the OS clips the icon shape.
await emit('icon-maskable-192.png', 192, { padding: 0.18 });
await emit('icon-maskable-512.png', 512, { padding: 0.18 });

// Monochrome: dark wordmark on transparent background. Android 13+ uses
// this for "themed icons" mode (the system tints it to match the user's
// wallpaper-derived theme). Without a monochrome variant Android falls
// back to a generic outline, which can also throw off the home-screen
// label-colour heuristic.
await emit('icon-monochrome-192.png', 192, {
  padding: 0.12,
  transparent: true,
});
await emit('icon-monochrome-512.png', 512, {
  padding: 0.12,
  transparent: true,
});

// Browser-tab favicons. Distinct from the PWA icons: at 16–32 px the
// wordmark is unreadable, so the splat glyph is the right visual.
async function emitFavicon(name, size) {
  const buf = await sharp(splatSvg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: bg })
    .flatten({ background: bg })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(root, 'public', name), buf);
  console.log('wrote public/' + name, buf.length, 'bytes');
}
await emitFavicon('favicon-16.png', 16);
await emitFavicon('favicon-32.png', 32);

// app/icon.png is the App Router's auto-wired favicon. Splat glyph at
// 32 px — same source as the public/favicon-32 fallback.
const appIcon = await sharp(splatSvg, { density: 384 })
  .resize(32, 32, { fit: 'contain', background: bg })
  .flatten({ background: bg })
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(join(root, 'app', 'icon.png'), appIcon);
console.log('wrote app/icon.png', appIcon.length, 'bytes');
