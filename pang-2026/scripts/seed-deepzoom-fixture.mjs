#!/usr/bin/env node
/**
 * PANG — deep-zoom smoke fixture.
 *
 * Generates a 1024 × 1024 test-pattern PNG at
 * `public/vendor/deepzoom/sample.png`. The image is a checkerboard
 * with centred OKLCH-ish fill blocks so a pinch to 3× on the smoke
 * route visibly reveals structure the 1× fit-to-viewport render
 * could not show — the visual proof that deep zoom is exercising
 * OSD's tile pipeline and not a CSS scale.
 *
 * Ships no external deps: raw PNG bytes via the CRC32 + zlib
 * primitives that ship with Node. Runs in < 100 ms on every
 * platform.
 *
 * Regenerate with: `node scripts/seed-deepzoom-fixture.mjs`
 * Checked into the repo; re-running produces a byte-identical file.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT = join(__dirname, "..", "public", "vendor", "deepzoom", "sample.png");

const W = 1024;
const H = 1024;
const CELL = 64;

// Build an RGBA pixel buffer.
const pixels = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const light = (cx + cy) % 2 === 0;
    // Paper warmth palette — approximates the OKLCH tokens but in
    // sRGB bytes since PNG is 8-bit sRGB. Exact OKLCH rendering is
    // not the point; the visual distinction between 1× and 3× is.
    const base = light ? 242 : 18;
    let r = base;
    let g = base;
    let b = base;
    // Inset a centred ring so 3× zoom reveals a structure the full-
    // frame render could not isolate.
    const dx = x - W / 2;
    const dy = y - H / 2;
    const r2 = dx * dx + dy * dy;
    if (r2 > 120 * 120 && r2 < 140 * 140) {
      r = 139;
      g = 87;
      b = 42;
    }
    const i = (y * W + x) * 4;
    pixels[i + 0] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
}

// Raw IDAT: one filter byte (0 = none) per scanline + RGBA bytes.
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  pixels.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}
const idatData = deflateSync(raw);

// CRC32 table.
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const SIGN = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// IHDR: 13 bytes.
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

const png = Buffer.concat([
  SIGN,
  chunk("IHDR", ihdr),
  chunk("IDAT", idatData),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
process.stdout.write(`${OUT} (${png.length} bytes)\n`);
