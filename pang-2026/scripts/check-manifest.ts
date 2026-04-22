#!/usr/bin/env node
/**
 * PANG — manifest validator.
 *
 * A focused re-run of P1 for fast feedback during local work without
 * loading the full gate runner. Identical semantics; useful as a
 * pre-commit hook and as the `check:manifest` script target.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const PATH = "public/manifest.webmanifest";

interface ManifestShape {
  name?: unknown;
  short_name?: unknown;
  start_url?: unknown;
  scope?: unknown;
  display?: unknown;
  background_color?: unknown;
  theme_color?: unknown;
  icons?: Array<{ sizes?: string; purpose?: string; src?: string }>;
  share_target?: unknown;
  launch_handler?: unknown;
}

async function main(): Promise<void> {
  try {
    await stat(join(ROOT, PATH));
  } catch {
    console.error(`manifest: ${PATH} missing`);
    process.exit(1);
  }

  const raw = await readFile(join(ROOT, PATH), "utf8");
  let m: ManifestShape;
  try {
    m = JSON.parse(raw) as ManifestShape;
  } catch (e) {
    console.error(`manifest: parse error — ${(e as Error).message}`);
    process.exit(1);
  }

  const required: Array<keyof ManifestShape> = [
    "name",
    "short_name",
    "start_url",
    "display",
    "background_color",
    "theme_color",
    "icons",
  ];
  const missing = required.filter((k) => m[k] == null);
  if (missing.length) {
    console.error(`manifest: missing keys — ${missing.join(", ")}`);
    process.exit(1);
  }
  if (m.display !== "standalone") {
    console.error(`manifest: display must be "standalone"`);
    process.exit(1);
  }
  const icons = m.icons ?? [];
  const has192 = icons.some((i) => i.sizes === "192x192");
  const has512 = icons.some((i) => i.sizes === "512x512");
  const hasMaskable = icons.some((i) => (i.purpose ?? "").includes("maskable"));
  if (!has192 || !has512 || !hasMaskable) {
    console.error(
      `manifest: need 192x192 + 512x512 + at least one maskable icon`,
    );
    process.exit(1);
  }
  console.log("manifest: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
