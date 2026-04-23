#!/usr/bin/env node
/**
 * PANG — gate runner.
 *
 * Mechanical enforcement of the 48 gates. Gates plug in as their
 * subject matter lands:
 *
 *   iter #0  — P1–P10, P23, P24                                  (platform floor)
 *   iter #1  — + A1–A4, A7, A8, A16, A21                         (intake agent)
 *   iter #2  — + P11, P15, P19, P20, P25, A10                    (the Room + zero-tap review)
 *
 * Each gate is a pure function `() => GateResult`. A gate can pass,
 * fail (CI-blocking), or skip (with a named reason — e.g. "no /fonts
 * checked in; dev-only"). Skipping in CI is explicit: the runner sets
 * `PANG_STRICT=1` which promotes every skip to a failure.
 *
 * Output is a compact report. On failure, exit code 1.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { scanForTransformScale } from "./check-transforms";

const ROOT = process.cwd();
const STRICT = process.env["PANG_STRICT"] === "1";

type GateStatus = "pass" | "fail" | "skip";
interface GateResult {
  id: string;
  title: string;
  status: GateStatus;
  detail: string;
}

// ---------- helpers ------------------------------------------------

async function read(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(join(ROOT, path));
    return true;
  } catch {
    return false;
  }
}

function pass(id: string, title: string, detail = "ok"): GateResult {
  return { id, title, status: "pass", detail };
}
function fail(id: string, title: string, detail: string): GateResult {
  return { id, title, status: "fail", detail };
}
function skip(id: string, title: string, detail: string): GateResult {
  return STRICT
    ? { id, title, status: "fail", detail: `strict: ${detail}` }
    : { id, title, status: "skip", detail };
}

// ---------- gates --------------------------------------------------

/**
 * P1 — PWA manifest: present and parseable.
 */
async function p1(): Promise<GateResult> {
  const id = "P1";
  const title = "manifest.webmanifest present + parseable";
  if (!(await exists("public/manifest.webmanifest"))) {
    return fail(id, title, "public/manifest.webmanifest missing");
  }
  try {
    const raw = await read("public/manifest.webmanifest");
    const m = JSON.parse(raw);
    const required = [
      "name",
      "short_name",
      "start_url",
      "display",
      "icons",
      "background_color",
      "theme_color",
    ];
    const missing = required.filter((k) => !(k in m));
    if (missing.length)
      return fail(id, title, `missing keys: ${missing.join(", ")}`);
    if (!Array.isArray(m.icons) || m.icons.length < 2)
      return fail(id, title, "need at least two icon sizes");
    const has192 = m.icons.some(
      (i: { sizes?: string }) => i.sizes === "192x192",
    );
    const has512 = m.icons.some(
      (i: { sizes?: string }) => i.sizes === "512x512",
    );
    const hasMaskable = m.icons.some((i: { purpose?: string }) =>
      (i.purpose ?? "").includes("maskable"),
    );
    if (!has192 || !has512)
      return fail(id, title, "need 192x192 and 512x512 icons");
    if (!hasMaskable) return fail(id, title, "need at least one maskable icon");
    if (m.display !== "standalone")
      return fail(id, title, `display must be "standalone"`);
    return pass(id, title);
  } catch (e) {
    return fail(id, title, `parse error: ${(e as Error).message}`);
  }
}

/**
 * P2 — Install capability: manifest + iOS branching present.
 */
async function p2(): Promise<GateResult> {
  const id = "P2";
  const title = "install hook handles Chromium + iOS branches";
  if (!(await exists("src/hooks/useInstallPrompt.ts"))) {
    return fail(id, title, "useInstallPrompt.ts missing");
  }
  const src = await read("src/hooks/useInstallPrompt.ts");
  if (!src.includes("beforeinstallprompt"))
    return fail(id, title, "missing beforeinstallprompt branch");
  if (!src.includes("display-mode: standalone"))
    return fail(id, title, "missing iOS standalone detection");
  return pass(id, title);
}

/**
 * P3 — Service worker: present, served no-cache, enables Navigation
 * Preload.
 */
async function p3(): Promise<GateResult> {
  const id = "P3";
  const title = "service worker + navigation preload + no-cache header";
  if (!(await exists("public/sw.js")))
    return fail(id, title, "public/sw.js missing");
  const sw = await read("public/sw.js");
  if (!sw.includes("navigationPreload"))
    return fail(id, title, "sw.js missing navigationPreload.enable()");
  const nextConfig = await read("next.config.ts");
  if (!nextConfig.includes("/sw.js"))
    return fail(id, title, "next.config.ts missing /sw.js header block");
  if (!nextConfig.includes("no-cache"))
    return fail(id, title, "/sw.js must be served with no-cache");
  if (!nextConfig.includes("Service-Worker-Allowed"))
    return fail(id, title, "/sw.js missing Service-Worker-Allowed header");
  return pass(id, title);
}

/**
 * P4 — Offline boot: SW has an HTML fallback path.
 */
async function p4(): Promise<GateResult> {
  const id = "P4";
  const title = "offline boot: network-first HTML with cached fallback";
  if (!(await exists("public/sw.js")))
    return fail(id, title, "public/sw.js missing");
  const sw = await read("public/sw.js");
  if (!sw.includes("handleNavigation"))
    return fail(id, title, "sw.js missing navigation handler");
  if (!sw.includes("caches.open"))
    return fail(id, title, "sw.js missing cache reads");
  return pass(id, title);
}

/**
 * P5 — OPFS bootstrap on first paint.
 */
async function p5(): Promise<GateResult> {
  const id = "P5";
  const title = "OPFS bootstrap + persist best-effort";
  if (!(await exists("src/lib/storage/bootstrap.ts")))
    return fail(id, title, "src/lib/storage/bootstrap.ts missing");
  const src = await read("src/lib/storage/bootstrap.ts");
  if (!src.includes("navigator.storage.getDirectory"))
    return fail(id, title, "missing getDirectory()");
  if (!src.includes("persist"))
    return fail(id, title, "missing storage.persist()");
  // Confirm AppBoot calls bootstrapOpfs.
  if (!(await exists("src/components/AppBoot.tsx")))
    return fail(id, title, "AppBoot.tsx missing; bootstrap not wired");
  const boot = await read("src/components/AppBoot.tsx");
  if (!boot.includes("bootstrapOpfs"))
    return fail(id, title, "AppBoot.tsx does not call bootstrapOpfs()");
  return pass(id, title);
}

/**
 * P6 — Strict CSP: per-request nonce via `proxy.ts`, no
 * `'unsafe-inline'` / `'unsafe-eval'` on any script-src directive
 * anywhere in the repo, `'strict-dynamic'` in use, HSTS preload,
 * Permissions-Policy locks the sensor list.
 *
 * The CSP lives in two places by design: `proxy.ts` emits the
 * per-request nonce header on HTML navigations, and `next.config.ts`
 * emits the baseline static-asset header. Both sources are scanned
 * for forbidden atoms.
 */
async function p6(): Promise<GateResult> {
  const id = "P6";
  const title = "strict CSP + HSTS preload + Permissions-Policy";

  // ---- Proxy (Next 16 rename of middleware): nonce source of truth ----
  if (!(await exists("proxy.ts")))
    return fail(id, title, "proxy.ts missing (CSP nonce source)");
  const mw = await read("proxy.ts");
  if (!/Content-Security-Policy/.test(mw))
    return fail(id, title, "proxy.ts must emit Content-Security-Policy");
  if (!/nonce-/.test(mw))
    return fail(id, title, "proxy.ts must emit a per-request nonce");
  if (!/['"]?strict-dynamic['"]?/.test(mw))
    return fail(id, title, "proxy.ts CSP must declare 'strict-dynamic'");

  // ---- Baseline CSP in next.config.ts for static assets ----
  const cfg = await read("next.config.ts");
  if (!cfg.includes("Content-Security-Policy"))
    return fail(id, title, "next.config.ts missing baseline CSP");
  if (!cfg.includes("'strict-dynamic'"))
    return fail(id, title, "baseline CSP must declare 'strict-dynamic'");
  if (!cfg.includes("frame-ancestors 'none'"))
    return fail(id, title, "frame-ancestors must be 'none'");
  if (!cfg.includes("Strict-Transport-Security"))
    return fail(id, title, "HSTS missing");
  if (!/max-age=\d{8,}/.test(cfg))
    return fail(id, title, "HSTS max-age too short (need >= 1 year)");
  if (!cfg.includes("preload"))
    return fail(id, title, "HSTS missing preload");
  if (!cfg.includes("Permissions-Policy"))
    return fail(id, title, "Permissions-Policy missing");
  if (!cfg.includes("geolocation=()"))
    return fail(id, title, "geolocation must be off");

  // ---- Repo-wide forbidden-atom scan on script-src directives ----
  // Catches regressions where a dev-branch CSP sneaks `'unsafe-inline'`
  // or `'unsafe-eval'` onto the script-src of either source.
  const cspSources: Array<[string, string]> = [
    ["proxy.ts", mw],
    ["next.config.ts", cfg],
  ];
  for (const [path, text] of cspSources) {
    // Match every directive block that names script-src; accept multi-line
    // template literals by disabling dotall-cross-directive slicing at
    // semicolons.
    const scriptDirectives = text.match(/script-src[^;`"']*(?:['"][^'"]*['"][^;`"']*)*/g) ?? [];
    for (const directive of scriptDirectives) {
      if (directive.includes("'unsafe-inline'"))
        return fail(id, title, `${path}: script-src contains 'unsafe-inline'`);
      if (directive.includes("'unsafe-eval'"))
        return fail(id, title, `${path}: script-src contains 'unsafe-eval'`);
    }
  }

  return pass(id, title);
}

/**
 * P7 — Core Web Vitals gate: build must declare the budgets. Live
 * measurement plugs in iteration #5 via PerformanceObserver.
 */
async function p7(): Promise<GateResult> {
  const id = "P7";
  const title = "INP 200ms p75 + LoAF observer declared";
  // Iteration #0 ships the budget declaration. The observer code
  // lands with the Room. Accept this as a declared ceiling check.
  const gatesDoc = "../PANG_Gates.md";
  if (!(await exists(gatesDoc))) {
    return skip(
      id,
      title,
      "PANG_Gates.md not at sibling path; declaration check skipped",
    );
  }
  const doc = await read(gatesDoc);
  if (!/INP[^\n]*200/.test(doc))
    return fail(id, title, "P7 in PANG_Gates.md must declare INP 200ms budget");
  if (!/long-animation-frame/.test(doc))
    return fail(id, title, "P7 must reference long-animation-frame observer");
  return pass(id, title);
}

/**
 * P8 — View Transitions enabled.
 */
async function p8(): Promise<GateResult> {
  const id = "P8";
  const title = "View Transitions API enabled in next.config";
  const src = await read("next.config.ts");
  if (!src.includes("viewTransition"))
    return fail(id, title, "viewTransition experimental flag missing");
  if (!src.includes("viewTransition: true"))
    return fail(id, title, "viewTransition must be true");
  return pass(id, title);
}

/**
 * P9 — No DOM for primary art surfaces: The Room mounts a <canvas>.
 * Iteration #0 ships the placeholder route only — accept a TODO
 * marker referencing the canvas mount.
 */
async function p9(): Promise<GateResult> {
  const id = "P9";
  const title = "The Room reserves a <canvas> surface";
  if (!(await exists("app/page.tsx")))
    return fail(id, title, "app/page.tsx missing");
  const src = await read("app/page.tsx");
  if (!/canvas/i.test(src))
    return fail(
      id,
      title,
      "app/page.tsx must mention the canvas surface (iteration #4 mounts it)",
    );
  return pass(id, title);
}

/**
 * P10 — Passkey-only auth. Iteration #0 reserves the surface; the
 * invite route must not set a password field.
 */
async function p10(): Promise<GateResult> {
  const id = "P10";
  const title = "no password surfaces; passkey-only";
  if (!(await exists("app/i/[token]/page.tsx")))
    return fail(id, title, "invite route missing");
  const src = await read("app/i/[token]/page.tsx");
  if (/type=["']password["']/.test(src))
    return fail(id, title, "password input present");
  return pass(id, title);
}

/**
 * P23 — Canvas a11y floor: no references to the unshipped
 * `element.accessibleNode`; presence of `drawFocusIfNeeded` is not
 * required until iteration #4 mounts the canvas.
 */
async function p23(): Promise<GateResult> {
  const id = "P23";
  const title = "no AOM phase-4 references; shipped pattern only";
  const pattern = /\.accessibleNode\b/;
  const files = [
    "src/design/locked.ts",
    "src/design/preferences.ts",
    "src/design/knobs.css",
    "src/design/fonts.ts",
    "src/components/AppBoot.tsx",
    "src/lib/storage/bootstrap.ts",
    "src/sw/register.ts",
    "src/auth/tier.ts",
    "src/hooks/useInstallPrompt.ts",
    "app/page.tsx",
    "app/layout.tsx",
    "app/globals.css",
  ];
  for (const f of files) {
    if (!(await exists(f))) continue;
    const src = await read(f);
    if (pattern.test(src))
      return fail(id, title, `${f} references element.accessibleNode`);
  }
  return pass(id, title);
}

/**
 * P24 — Design-token discipline:
 *   - `--knob-*` custom properties referenced anywhere must be a
 *     subset of the declared nine.
 *   - No magic spacing/size literals in `src/components/**` — values
 *     must come from tokens or SPACING_PX.
 *   - Preferences store must not touch localStorage.
 */
async function p24(): Promise<GateResult> {
  const id = "P24";
  const title = "design-token discipline (knobs, spacing, no localStorage)";

  // 24a: knobs referenced ⊆ declared.
  //
  // The declared set is the DS Appendix A canonical nine. The Phase-3
  // migration retired the legacy preference-store names; adding a
  // tenth knob is a doctrine edit (Appendix F + Architecture § 1.5).
  // Mirrors `KNOB_CSS_VARS` in `src/design/locked.ts`.
  const declared = new Set<string>([
    "--knob-time-warmth",
    "--knob-warmth-multiplier",
    "--knob-wall-gap",
    "--knob-density",
    "--knob-motion",
    "--knob-confidence-visibility",
    "--knob-serif-weight",
    "--knob-label-case",
    "--knob-radii",
  ]);
  const used = new Set<string>();
  const scanDirs = ["src", "app"];
  async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    const { readdir } = await import("node:fs/promises");
    let entries;
    try {
      entries = await readdir(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) out.push(...(await walk(p)));
      else if (/\.(ts|tsx|css|mjs)$/.test(e.name)) out.push(p);
    }
    return out;
  }
  const files: string[] = [];
  for (const d of scanDirs) files.push(...(await walk(d)));
  const KNOB_RE = /--knob-[a-z0-9-]+/g;
  for (const f of files) {
    const src = await read(f);
    for (const m of src.matchAll(KNOB_RE)) used.add(m[0]);
  }
  const stray = [...used].filter((k) => !declared.has(k));
  if (stray.length)
    return fail(
      id,
      title,
      `undeclared knobs: ${stray.join(", ")}. Register them in locked.ts or remove.`,
    );

  // 24b: preferences must not *use* localStorage. Prose comments
  // that name it (e.g. "Persisted to OPFS — not localStorage") are
  // allowed; only property access / bracket access is a failure.
  if (await exists("src/design/preferences.ts")) {
    const prefs = await read("src/design/preferences.ts");
    // Strip line and block comments before scanning.
    const stripped = prefs
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:\/])\/\/.*$/gm, "$1");
    if (/localStorage\s*[.[]/.test(stripped))
      return fail(id, title, "preferences.ts uses localStorage");
  }

  // 24c: no magic spacing literals in components
  // Permit design tokens, CSS custom properties, and values named in
  // SPACING_PX. Scan is narrow: style props + Tailwind arbitrary
  // values that look like `p-[12px]`, `m-[7px]`, etc.
  const SPACING_PX = [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128];
  const arbSpacingRe = /(?:p|m|gap|w|h|top|bottom|left|right)-\[(\d+)px\]/g;
  for (const f of files) {
    if (!f.startsWith("src/components/") && !f.startsWith("app/")) continue;
    const src = await read(f);
    for (const m of src.matchAll(arbSpacingRe)) {
      const n = Number(m[1]);
      if (!SPACING_PX.includes(n))
        return fail(
          id,
          title,
          `${f} uses non-scale spacing: ${m[0]} (scale: ${SPACING_PX.join(",")})`,
        );
    }
  }

  // 24d: no CSS `transform: scale(...)` / Tailwind `scale-*` outside
  // the sanctioned DeepZoom adapter (Primitive §21, iter #7 uplift).
  // The anti-pattern — pinching a flat JPEG with `transform: scale(2)`
  // — regresses crisp-at-1× imagery to mush at 2×. Deep zoom lives
  // behind OpenSeadragon in `src/components/deep-zoom/` exclusively.
  const scaleScan = await scanForTransformScale();
  if (!scaleScan.ok) {
    const first = scaleScan.violations[0]!;
    return fail(
      id,
      title,
      `${first.path}:${first.line} uses transform scale (${first.match}) — ` +
        `deep zoom lives behind OpenSeadragon in src/components/deep-zoom/`,
    );
  }

  return pass(id, title);
}

// ---------- P-gates (iteration #2 additions) ----------------------

/**
 * Shared source-tree walker. Returns paths (relative to repo root)
 * for every file under `roots` that matches `exts`. Directories under
 * `skip` (e.g. `src/lib/motion`, `_archive`) are pruned. Results
 * include `.ts`, `.tsx`, `.css`, `.mjs` by default — the widest set
 * any gate needs — and gates filter further by prefix.
 */
async function walkRepoFiles(
  roots: string[],
  exts: readonly string[] = ["ts", "tsx", "css", "mjs"],
  skip: readonly string[] = [],
): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const out: string[] = [];
  const allowed = new Set(exts);
  async function visit(dir: string): Promise<void> {
    if (skip.some((s) => dir === s || dir.startsWith(`${s}/`))) return;
    let entries;
    try {
      entries = await readdir(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        await visit(p);
      } else {
        const ext = e.name.split(".").pop();
        if (ext && allowed.has(ext)) out.push(p);
      }
    }
  }
  for (const r of roots) await visit(r);
  return out;
}

/**
 * P11 — OKLCH-only colour. No hex triplet/quad/6/8, `rgb()`, `rgba()`,
 * `hsl()`, or `hsla()` literal in any `.css` or inline `style={{…}}`
 * in `src/**` / `app/**`. `currentColor`, `transparent`, named CSS
 * keywords, and token references are fine; OKLCH is preferred.
 *
 * The scan is literal — a regex hit in source text. A comment that
 * *describes* hex (e.g. "#fff was ... replaced with oklch") will
 * trigger the gate on purpose: doctrine says drop the old literal
 * entirely so diffs stay clean.
 */
async function p11(): Promise<GateResult> {
  const id = "P11";
  const title = "OKLCH-only colour; no hex/rgb/hsl literals";
  const files = await walkRepoFiles(["src", "app"], ["ts", "tsx", "css"]);
  // Hex colour literals: #rgb | #rgba | #rrggbb | #rrggbbaa. The
  // leading boundary prevents id-selector false-positives like `#abc { ... }`
  // in a CSS selector position, which would not be a colour; we
  // require the hex to follow `:`, `(`, or whitespace after an `=`.
  const hexRe = /(?:[:=]\s*|\(\s*|,\s*)#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
  const funcRe = /\b(?:rgb|rgba|hsl|hsla)\s*\(/;
  for (const f of files) {
    const src = await read(f);
    if (hexRe.test(src)) {
      // Report the first offending line for actionability.
      const line = src.split("\n").findIndex((ln) => hexRe.test(ln)) + 1;
      return fail(id, title, `${f}:${line} uses a hex colour literal`);
    }
    if (funcRe.test(src)) {
      const line = src.split("\n").findIndex((ln) => funcRe.test(ln)) + 1;
      return fail(id, title, `${f}:${line} uses rgb/rgba/hsl/hsla()`);
    }
  }
  return pass(id, title);
}

/**
 * P15 — Springs default. Arbitrary `cubic-bezier(...)` curves outside
 * `src/lib/motion/` are a 2018-era habit; 2026 motion lives in
 * `linear()` easing, View Transitions, and a small preset library.
 * Allowed via an explicit opt-out comment `p15-exception:` immediately
 * above the line — for the one-off case an upstream CSS feature
 * genuinely requires it.
 *
 * Ban is narrow: the literal string `cubic-bezier(`. `linear(0, ...)`
 * (the new CSS easing function) is fine. Our View Transitions
 * scaffold in `app/globals.css` already uses `linear(...)`.
 */
async function p15(): Promise<GateResult> {
  const id = "P15";
  const title = "Springs default; no cubic-bezier() outside motion lib";
  const files = await walkRepoFiles(
    ["src", "app"],
    ["ts", "tsx", "css"],
    ["src/lib/motion"],
  );
  const re = /cubic-bezier\s*\(/;
  for (const f of files) {
    const src = await read(f);
    if (!re.test(src)) continue;
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i]!)) continue;
      const prev = lines[i - 1] ?? "";
      if (/p15-exception:/.test(prev)) continue;
      return fail(
        id,
        title,
        `${f}:${i + 1} cubic-bezier(...) without 'p15-exception:' comment`,
      );
    }
  }
  return pass(id, title);
}

/**
 * P19 — Canvas for art. The Room must render through a canvas surface
 * backed by tier-picked renderers (WebGPU → WebGL2). Mechanical check:
 *
 *   1. `src/room/gpu/renderer.ts` and `src/room/gl2/renderer.ts` exist.
 *   2. The scene factory exists and re-exports the metric constants.
 *   3. `app/page.tsx` mounts `TheRoomCanvas` (directly or transitively
 *      through a `_the-room/*Client` composition).
 *   4. `app/page.tsx` does NOT use `display: grid`, `columns:`, or a
 *      masonry pattern for art — those are the 2018 shelf-pack habit.
 *
 * The "no DOM grid for art" check is coarse: we scan `app/page.tsx`
 * (the Room root) for forbidden CSS atoms. Other routes (lists,
 * chrome) may still use grid / columns freely.
 */
async function p19(): Promise<GateResult> {
  const id = "P19";
  const title = "The Room renders through a canvas with tiered renderers";
  if (!(await exists("src/room/gpu/renderer.ts")))
    return fail(id, title, "src/room/gpu/renderer.ts missing (WebGPU tier)");
  if (!(await exists("src/room/gl2/renderer.ts")))
    return fail(id, title, "src/room/gl2/renderer.ts missing (WebGL2 tier)");
  if (!(await exists("src/room/scene.ts")))
    return fail(id, title, "src/room/scene.ts missing");
  if (!(await exists("src/room/dom/TheRoomCanvas.tsx")))
    return fail(id, title, "TheRoomCanvas.tsx missing");
  const page = await read("app/page.tsx");
  if (!/TheRoom(Client|Canvas)/.test(page))
    return fail(
      id,
      title,
      "app/page.tsx must mount TheRoomClient / TheRoomCanvas (canvas composition)",
    );
  if (/display:\s*grid/.test(page) || /\bcolumns:\s*\d/.test(page))
    return fail(
      id,
      title,
      "app/page.tsx uses display: grid / columns for art — use canvas",
    );
  return pass(id, title);
}

/**
 * P20 — CV in a worker. Segmentation + rectangle detection must live
 * in `src/workers/cv/*.worker.ts` files, and the main thread reaches
 * them only via the dispatch boundary (`src/workers/cv/dispatch.ts`
 * or `cameraControl.ts` instantiating a `new Worker(new URL(...,
 * import.meta.url))`). Direct main-thread imports of any worker-only
 * identifier are the regression we're guarding against.
 */
async function p20(): Promise<GateResult> {
  const id = "P20";
  const title = "CV (segmenter + rectangle detector) runs in a worker";
  for (const w of [
    "src/workers/cv/segmenter.worker.ts",
    "src/workers/cv/rectangleDetector.worker.ts",
    "src/workers/cv/dispatch.ts",
  ]) {
    if (!(await exists(w))) return fail(id, title, `${w} missing`);
  }
  // Forbid any main-thread file from statically importing a
  // `.worker.ts` module *at runtime*. The legitimate shape is
  // `new Worker(new URL("./foo.worker.ts", import.meta.url))` which
  // uses a URL literal, not an `import { ... } from ".worker"`.
  //
  // `import type { ... } from ".worker"` is fine: TypeScript erases
  // type-only imports at build time, so no worker code runs on the
  // main thread. The regex requires a *non-type* `import` to trip.
  const files = await walkRepoFiles(["src", "app"], ["ts", "tsx"]);
  const staticWorkerImport =
    /^\s*import\s+(?!type\b)[^;]*from\s+['"][^'"]*\.worker(?:\.ts)?['"]/m;
  for (const f of files) {
    if (f.startsWith("src/workers/cv/")) continue;
    const src = await read(f);
    if (staticWorkerImport.test(src)) {
      return fail(
        id,
        title,
        `${f} statically imports a .worker module at runtime — use new Worker(new URL(...))`,
      );
    }
  }
  return pass(id, title);
}

/**
 * P25 — Zero-tap review. Between capture and arrival, no *required*
 * text input / textarea / select may render, and no `<select>` at all
 * (every select in this surface family has historically meant a
 * required choice). Edits are opt-in: the collector can tap a field
 * to open a free-text editor, but the "add to wall" path is always
 * available unconditionally.
 *
 * Mechanical check: scan `app/scan/**` and `src/components/intake/**`:
 *
 *   1. No `<select>` element anywhere.
 *   2. No `required` attribute on any `<input>` / `<textarea>`.
 *   3. `IntakeReview.tsx` exports a button with `aria-label="add to
 *      wall"` (the arrival gateway) and does not declare `disabled=`
 *      on it anywhere.
 */
async function p25(): Promise<GateResult> {
  const id = "P25";
  const title = "Zero-tap review between capture and arrival";
  const files = await walkRepoFiles(
    ["app/scan", "src/components/intake"],
    ["ts", "tsx"],
  );
  for (const f of files) {
    const src = await read(f);
    if (/<select\b/.test(src))
      return fail(id, title, `${f} renders <select> in the scan surface`);
    if (/\brequired\b\s*(=|\/>|>)/.test(src)) {
      // Narrow: only flag if it's on an input/textarea/select element.
      // Tolerate code that mentions "required" in a prop-type comment.
      const re = /<(?:input|textarea|select)\b[^>]*\brequired\b[^>]*>/;
      if (re.test(src))
        return fail(id, title, `${f} has a required input in scan surface`);
    }
  }
  // "Add to wall" entry point must be present and unconditional.
  if (!(await exists("src/components/intake/IntakeReview.tsx")))
    return fail(id, title, "IntakeReview.tsx missing");
  const review = await read("src/components/intake/IntakeReview.tsx");
  if (!/aria-label=["']add to wall["']/.test(review))
    return fail(
      id,
      title,
      'IntakeReview.tsx must expose a button with aria-label="add to wall"',
    );
  // Guard against a disabled= gate creeping onto the arrival button.
  // Flag any `disabled=` within five lines of the aria-label="add to
  // wall" marker — correct, simple, and easy to override intentionally
  // (move the disabled prop further in the JSX if genuinely needed).
  const lines = review.split("\n");
  const idx = lines.findIndex((ln) => /aria-label=["']add to wall["']/.test(ln));
  if (idx >= 0) {
    const window = lines.slice(Math.max(0, idx - 5), idx + 5).join("\n");
    if (/\bdisabled=/.test(window))
      return fail(
        id,
        title,
        "IntakeReview.tsx gates the add-to-wall button with disabled=",
      );
  }
  return pass(id, title);
}

// ---------- A-gates (iteration #1 subset) -------------------------

/** Recursive walker used by several A-gates. */
async function walkAgentFiles(): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const out: string[] = [];
  async function visit(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) await visit(p);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
  }
  // DS Appendix D layout: the AI surface lives under `src/ai/**`;
  // the route-handler API still lives under `app/api/**`.
  await visit("src/ai/agents");
  await visit("src/ai/camel");
  await visit("src/ai/tools");
  await visit("src/ai/prompts");
  await visit("src/workers/cv");
  await visit("app/api");
  return out;
}

/**
 * A1 — No `JSON.parse` on AI model output. Structured tool_use is
 * the only shape that crosses the schema gate. Raw text payloads
 * from `messages.create` must never be parsed.
 *
 * We allow `JSON.parse` on form-metadata (user-declared) and on OPFS
 * sidecars (our own writes). Disallow inside the agents directory
 * except at the metadata boundary.
 */
async function a1(): Promise<GateResult> {
  const id = "A1";
  const title = "no JSON.parse on AI model output";
  const files = await walkAgentFiles();
  for (const f of files) {
    if (!f.startsWith("src/ai/agents/")) continue;
    const src = await read(f);
    if (/JSON\.parse/.test(src)) {
      return fail(id, title, `${f} calls JSON.parse — use extractToolUse + Zod`);
    }
  }
  return pass(id, title);
}

/**
 * A2 — Every Anthropic call site uses tool_use + schema. Scan for
 * `messages.create` calls in `src/ai/agents/*`; each must be
 * accompanied by `tool_choice` and a `tools` array.
 */
async function a2(): Promise<GateResult> {
  const id = "A2";
  const title = "every messages.create declares tool_choice + tools";
  const files = await walkAgentFiles();
  for (const f of files) {
    if (!f.startsWith("src/ai/agents/")) continue;
    const src = await read(f);
    const calls = src.matchAll(/messages\.create\s*\(/g);
    let callCount = 0;
    for (const _ of calls) callCount++;
    if (callCount === 0) continue;
    if (!src.includes("tool_choice"))
      return fail(id, title, `${f} has messages.create without tool_choice`);
    if (!src.includes("tools:"))
      return fail(id, title, `${f} has messages.create without tools: [...]`);
  }
  return pass(id, title);
}

/**
 * A3 — Zod runtime validation of structured output. The only allowed
 * reader of tool-use output is `extractToolUse<T>()` followed by a
 * schema `.parse()` call. Grep for any place that reads `.input`
 * directly off an Anthropic message block.
 */
async function a3(): Promise<GateResult> {
  const id = "A3";
  const title = "tool_use input is Zod-parsed";
  const files = await walkAgentFiles();
  for (const f of files) {
    if (!f.startsWith("src/ai/agents/")) continue;
    if (f.endsWith("/_shared.ts")) continue; // extractToolUse lives here
    const src = await read(f);
    // Look for direct access into response.content[*].input.
    if (/\.content\[[^\]]+\]\.input\b/.test(src))
      return fail(id, title, `${f} reads .content[].input directly`);
    // If messages.create exists, require a Schema.parse alongside.
    if (/messages\.create\s*\(/.test(src) && !/Schema\.parse\s*\(/.test(src)) {
      return fail(id, title, `${f} does not run a Schema.parse on tool_use`);
    }
  }
  return pass(id, title);
}

/**
 * A4 — PANG_VOICE_SYSTEM_PROMPT is prepended to every P-LLM call.
 * Each `messages.create` with a `system:` array must include the
 * voice prompt *first* in the array (cache-ordered; voice is shared
 * across agents).
 */
async function a4(): Promise<GateResult> {
  const id = "A4";
  const title = "PANG_VOICE_SYSTEM_PROMPT prepended to P-LLM calls";
  const files = await walkAgentFiles();
  let checked = 0;
  for (const f of files) {
    if (!f.startsWith("src/ai/agents/")) continue;
    if (
      f.endsWith("/_shared.ts") ||
      f.endsWith("/models.ts") ||
      f.endsWith("/budgets.ts")
    )
      continue;
    const src = await read(f);
    if (!/messages\.create\s*\(/.test(src)) continue;
    // Files whose entire purpose is a Q-LLM (naming convention: the
    // filename ends with `-q.ts`) are exempt — the Q model must not
    // receive voice primitives it could reflect into a P channel.
    // Files that contain *both* Q and P calls (e.g. intake.ts with an
    // inlined `runQuarantined()` helper) must still include the voice
    // prompt because the P call demands it.
    const isDedicatedQ = /-q\.ts$/.test(f);
    if (isDedicatedQ) continue;
    if (!src.includes("PANG_VOICE_SYSTEM_PROMPT"))
      return fail(
        id,
        title,
        `${f} has a P-LLM call but does not include PANG_VOICE_SYSTEM_PROMPT`,
      );
    checked++;
  }
  if (checked === 0) {
    return skip(id, title, "no P-LLM call sites yet");
  }
  return pass(id, title);
}

/**
 * A7 — CaMeL capability graph present + referenced by agents.
 * Every agent file must import `assertCapability` from the shared
 * contract (it may forward through `_shared.ts`).
 */
async function a7(): Promise<GateResult> {
  const id = "A7";
  const title = "CaMeL capability graph + assertCapability used";
  if (!(await exists("src/ai/camel/capabilities.ts"))) {
    return fail(id, title, "capabilities.ts missing");
  }
  if (!(await exists("src/ai/camel/trust.ts"))) {
    return fail(id, title, "trust.ts missing");
  }
  const caps = await read("src/ai/camel/capabilities.ts");
  if (!/export\s+const\s+CAPABILITIES\s*=/.test(caps))
    return fail(id, title, "CAPABILITIES table not exported");
  if (!/export\s+function\s+assertCapability\b/.test(caps))
    return fail(id, title, "assertCapability not exported");

  // Every module under src/lib/agents that calls messages.create must
  // also call assertCapability before the call.
  const files = await walkAgentFiles();
  for (const f of files) {
    if (!f.startsWith("src/ai/agents/")) continue;
    if (f.endsWith("/_shared.ts") || f.endsWith("/models.ts") || f.endsWith("/budgets.ts")) continue;
    const src = await read(f);
    if (!/messages\.create\s*\(/.test(src)) continue;
    if (!/assertCapability\s*\(/.test(src))
      return fail(id, title, `${f} calls messages.create without assertCapability`);
  }
  return pass(id, title);
}

/**
 * A8 — Untrusted text enters the Q-LLM only through `wrapUntrusted`.
 * The helper escapes the control markers; direct interpolation of a
 * Q-branded string into a messages.create body is a CaMeL bypass.
 */
async function a8(): Promise<GateResult> {
  const id = "A8";
  const title = "Untrusted content enters Q-LLM via wrapUntrusted()";
  if (!(await exists("src/ai/camel/wrapUntrusted.ts"))) {
    return fail(id, title, "wrapUntrusted.ts missing");
  }
  const wrapFile = await read("src/ai/camel/wrapUntrusted.ts");
  if (!/export\s+function\s+wrapUntrusted\b/.test(wrapFile))
    return fail(id, title, "wrapUntrusted() not exported");

  // Any agent file that references `Untrusted<` must call
  // wrapUntrusted() before interpolating.
  const files = await walkAgentFiles();
  for (const f of files) {
    if (!f.startsWith("src/ai/agents/")) continue;
    const src = await read(f);
    if (!/Untrusted\s*<|untrustedDoc/.test(src)) continue;
    if (!src.includes("wrapUntrusted"))
      return fail(id, title, `${f} handles untrusted input without wrapUntrusted()`);
  }
  return pass(id, title);
}

/**
 * A16 — Intake queue uses an OPFS-backed staged/sidecar layout.
 * TUS-style resumable semantics require the sidecar to live next to
 * the image so a half-write is self-healing.
 */
async function a16(): Promise<GateResult> {
  const id = "A16";
  const title = "intake queue is OPFS-backed with sidecar JSON";
  if (!(await exists("src/workers/cv/intakeQueue.ts"))) {
    return fail(id, title, "intakeQueue.ts missing");
  }
  const q = await read("src/workers/cv/intakeQueue.ts");
  if (!q.includes("intake/staged"))
    return fail(id, title, "queue must target intake/staged directory");
  if (!/opfsWrite|opfsRead/.test(q))
    return fail(id, title, "queue must use opfs helpers");
  if (!/pending|uploading|done|failed/.test(q))
    return fail(id, title, "queue must declare pending/uploading/done/failed states");
  return pass(id, title);
}

/**
 * A10 — Every model call is wrapped in a `gen_ai.*` OpenTelemetry
 * span. The shim in `src/lib/otel/span.ts` exports `withOtelSpan`;
 * any file in `src/ai/agents/*` that calls `messages.create` must do
 * so inside a `withOtelSpan("...", ...)` block whose name starts with
 * `gen_ai.` (the OpenTelemetry GenAI semantic-conventions prefix).
 *
 * Static check: for each agent file with a `messages.create` call,
 * require both `withOtelSpan(` and a span name literal matching
 * `"gen_ai\..*"`. The scan is generous about formatting — it looks
 * at the file, not the AST — but the rule is crisp enough that
 * refactors can't accidentally slip an un-spanned call through.
 */
async function a10(): Promise<GateResult> {
  const id = "A10";
  const title = "Model calls wrapped in gen_ai.* OTel span";
  if (!(await exists("src/lib/otel/span.ts")))
    return fail(id, title, "src/lib/otel/span.ts missing (withOtelSpan shim)");
  const shim = await read("src/lib/otel/span.ts");
  if (!/export\s+(?:async\s+)?function\s+withOtelSpan\b/.test(shim))
    return fail(id, title, "withOtelSpan() not exported from span.ts");

  const files = await walkAgentFiles();
  let checked = 0;
  for (const f of files) {
    if (!f.startsWith("src/ai/agents/")) continue;
    if (
      f.endsWith("/_shared.ts") ||
      f.endsWith("/models.ts") ||
      f.endsWith("/budgets.ts")
    )
      continue;
    const src = await read(f);
    if (!/messages\.create\s*\(/.test(src)) continue;
    if (!/withOtelSpan\s*\(/.test(src))
      return fail(
        id,
        title,
        `${f} calls messages.create without withOtelSpan(...)`,
      );
    if (!/["'`]gen_ai\.[\w.]+["'`]/.test(src))
      return fail(
        id,
        title,
        `${f} has no gen_ai.* span name literal (required by OTel GenAI conventions)`,
      );
    checked++;
  }
  if (checked === 0) return skip(id, title, "no agent call sites yet");
  return pass(id, title);
}

/**
 * A21 — Each agent exports a `RETRY_POLICY` constant with the fields
 * the contract requires. The contract type is defined in _shared.ts.
 */
async function a21(): Promise<GateResult> {
  const id = "A21";
  const title = "each agent declares a RETRY_POLICY";
  const files = await walkAgentFiles();
  let checked = 0;
  for (const f of files) {
    if (!f.startsWith("src/ai/agents/")) continue;
    if (
      f.endsWith("/_shared.ts") ||
      f.endsWith("/models.ts") ||
      f.endsWith("/budgets.ts")
    )
      continue;
    const src = await read(f);
    if (!/messages\.create\s*\(/.test(src)) continue;
    if (!/export\s+const\s+RETRY_POLICY/.test(src))
      return fail(id, title, `${f} does not export RETRY_POLICY`);
    if (!/maxRetries/.test(src))
      return fail(id, title, `${f} RETRY_POLICY missing maxRetries`);
    if (!/onTerminalFailure/.test(src))
      return fail(id, title, `${f} RETRY_POLICY missing onTerminalFailure`);
    checked++;
  }
  if (checked === 0) {
    return skip(id, title, "no agent files with messages.create yet");
  }
  return pass(id, title);
}

// ---------- runner -------------------------------------------------

// Runner list. Order is **reading order**: P-gates in numeric order
// (grouped by family via the DS Appendix B convention), then A-gates.
// A new gate appended here is visible in the report the same run.
const GATES = [
  p1,
  p2,
  p3,
  p4,
  p5,
  p6,
  p7,
  p8,
  p9,
  p10,
  p11,
  p15,
  p19,
  p20,
  p23,
  p24,
  p25,
  a1,
  a2,
  a3,
  a4,
  a7,
  a8,
  a10,
  a16,
  a21,
];

async function main(): Promise<void> {
  const results: GateResult[] = [];
  for (const gate of GATES) {
    try {
      results.push(await gate());
    } catch (e) {
      results.push({
        id: gate.name.toUpperCase(),
        title: "gate threw",
        status: "fail",
        detail: (e as Error).message,
      });
    }
  }

  const pad = (s: string, n: number): string =>
    s.length >= n ? s : s + " ".repeat(n - s.length);
  const symbol: Record<GateStatus, string> = {
    pass: "OK  ",
    fail: "FAIL",
    skip: "skip",
  };

  console.log(
    "\nPANG gates — iteration #2 scope\n" +
      "  P1–P11, P15, P19, P20, P23–P25  +  A1–A4, A7, A8, A10, A16, A21",
  );
  console.log("─".repeat(70));
  for (const r of results) {
    console.log(
      `  [${symbol[r.status]}] ${pad(r.id, 4)} ${pad(r.title, 48)} ${
        r.detail === "ok" ? "" : r.detail
      }`,
    );
  }
  const failed = results.filter((r) => r.status === "fail");
  const skipped = results.filter((r) => r.status === "skip");
  console.log("─".repeat(70));
  console.log(
    `  ${results.length - failed.length - skipped.length} pass, ${failed.length} fail, ${skipped.length} skip\n`,
  );
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
