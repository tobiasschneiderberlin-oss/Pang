#!/usr/bin/env tsx
/**
 * PANG — generate evals/intake/fixtures/intake-01-label-synth.png.
 *
 * Paints a synthetic label-card image: a clean paper background with
 * a crisp artist / title / year / medium block rendered at large
 * size. The image is a deterministic PNG produced with pure Node —
 * no image library — so the fixture reproduces byte-identically on
 * any dev machine.
 *
 * Uses `PNG` via zlib for compression. The glyph set is a hand-rolled
 * 5×7 pixel bitmap font for ASCII — intentionally crude; the model
 * doesn't need antialiased glyphs to read short text, and keeping
 * the generator dep-free matters.
 *
 * Run once after checkout:
 *   tsx scripts/build-eval-fixture-01.ts
 *
 * Output: evals/intake/fixtures/intake-01-label-synth.png
 */

import { writeFile } from "node:fs/promises";
import { deflateSync, crc32 } from "node:zlib";
import { join } from "node:path";

// ---------- 5×7 pixel font ----------------------------------------
// Only the glyphs we use in this fixture. Each glyph is 5 wide × 7
// tall; the bit at row r, column c is set if that pixel is ink.
// Stored as 5-bit rows, top-to-bottom.
const FONT: Record<string, readonly number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01111, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b01111],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01111, 0b10000, 0b10000, 0b10011, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10010, 0b10001, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10001, 0b10101, 0b11011, 0b10001],
  Y: [0b10001, 0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100],
  a: [0, 0, 0b01110, 0b00001, 0b01111, 0b10001, 0b01111],
  c: [0, 0, 0b01111, 0b10000, 0b10000, 0b10000, 0b01111],
  d: [0b00001, 0b00001, 0b01111, 0b10001, 0b10001, 0b10001, 0b01111],
  e: [0, 0, 0b01110, 0b10001, 0b11111, 0b10000, 0b01110],
  g: [0, 0, 0b01111, 0b10001, 0b01111, 0b00001, 0b01110],
  h: [0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b10001],
  i: [0b00100, 0, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110],
  l: [0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  n: [0, 0, 0b11110, 0b10001, 0b10001, 0b10001, 0b10001],
  o: [0, 0, 0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
  p: [0, 0, 0b11110, 0b10001, 0b11110, 0b10000, 0b10000],
  r: [0, 0, 0b10110, 0b11001, 0b10000, 0b10000, 0b10000],
  s: [0, 0, 0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
  t: [0b00100, 0b00100, 0b01110, 0b00100, 0b00100, 0b00100, 0b00011],
  u: [0, 0, 0b10001, 0b10001, 0b10001, 0b10001, 0b01111],
  y: [0, 0, 0b10001, 0b10001, 0b01111, 0b00001, 0b01110],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0b01110, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0, 0b00100],
  "/": [0b00001, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b10000],
};

// ---------- Buffer helpers ----------------------------------------

const WIDTH = 800;
const HEIGHT = 600;
const INK = [30, 30, 30]; // near-black
const PAPER = [250, 250, 247]; // paper tone

function paintGlyph(
  pixels: Uint8Array,
  ch: string,
  x: number,
  y: number,
  scale: number,
): void {
  const glyph = FONT[ch] ?? FONT[" "]!;
  for (let r = 0; r < 7; r++) {
    const row = glyph[r]!;
    for (let c = 0; c < 5; c++) {
      if ((row >> (4 - c)) & 1) {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = x + c * scale + dx;
            const py = y + r * scale + dy;
            if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) continue;
            const idx = (py * WIDTH + px) * 3;
            pixels[idx] = INK[0]!;
            pixels[idx + 1] = INK[1]!;
            pixels[idx + 2] = INK[2]!;
          }
        }
      }
    }
  }
}

function paintLine(
  pixels: Uint8Array,
  text: string,
  x: number,
  y: number,
  scale: number,
): void {
  for (let i = 0; i < text.length; i++) {
    paintGlyph(pixels, text[i]!, x + i * 6 * scale, y, scale);
  }
}

// ---------- PNG encoder (no external deps) ------------------------

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(
  width: number,
  height: number,
  rgb: Uint8Array,
): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // Scanline filter prefix (0 = None) before each row.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Main --------------------------------------------------

async function main(): Promise<void> {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    pixels[i * 3] = PAPER[0]!;
    pixels[i * 3 + 1] = PAPER[1]!;
    pixels[i * 3 + 2] = PAPER[2]!;
  }

  // Layout: four centred lines at scale 6 (= 30px glyph height,
  // 36px line height). Room at top/bottom for margin.
  const SCALE = 6;
  const LINE_H = 7 * SCALE + 14;
  const lines = [
    "Test Artist",
    "Untitled Study",
    "2024",
    "graphite on paper",
    "21 x 29.7 cm",
  ];

  const blockHeight = lines.length * LINE_H;
  let y = Math.floor((HEIGHT - blockHeight) / 2);
  for (const text of lines) {
    const textWidth = text.length * 6 * SCALE;
    const x = Math.floor((WIDTH - textWidth) / 2);
    paintLine(pixels, text, x, y, SCALE);
    y += LINE_H;
  }

  const png = encodePng(WIDTH, HEIGHT, pixels);
  const outPath = join(
    process.cwd(),
    "evals",
    "intake",
    "fixtures",
    "intake-01-label-synth.png",
  );
  await writeFile(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

void main();
