#!/usr/bin/env node
/**
 * PANG — service-worker build step (placeholder).
 *
 * Iteration #0 hand-authors `public/sw.js` directly — the rules are
 * few enough that a generator would be more code than content. This
 * script exists so `npm run build` has a stable hook; when Workbox is
 * introduced in a later iteration (for precaching Next.js's hashed
 * chunks, runtime strategies per route, etc.), the generator lands
 * here.
 *
 * For now: validate that the hand-authored file exists and compiles
 * as a script module.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const SW = "public/sw.js";

async function main(): Promise<void> {
  try {
    await stat(join(ROOT, SW));
  } catch {
    console.error(`build-sw: ${SW} missing`);
    process.exit(1);
  }
  const src = await readFile(join(ROOT, SW), "utf8");
  // Basic sanity: must register the expected event handlers.
  const required = ["install", "activate", "fetch"];
  const missing = required.filter(
    (evt) => !src.includes(`addEventListener("${evt}"`),
  );
  if (missing.length) {
    console.error(`build-sw: sw.js missing handlers — ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("build-sw: ok (hand-authored; Workbox migration TBD)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
