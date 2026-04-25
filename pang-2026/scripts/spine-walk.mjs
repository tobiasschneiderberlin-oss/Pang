#!/usr/bin/env node
/**
 * PANG — full spine walk against a target URL.
 *
 * Drives a headless chromium with a fake camera through Laura's
 * cold-install path: open / → scan → capture → arrival → Room →
 * focus → ask gallery → mailto handoff. Captures every error,
 * console.error, network 4xx/5xx, missing affordance, and timing.
 *
 * Outputs a structured JSON report to stderr-friendly stdout +
 * screenshots to /tmp/pang-walk-<ts>/.
 *
 * Usage: node scripts/spine-walk.mjs <baseURL>
 *   default baseURL: https://pang-gamma.vercel.app
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "https://pang-gamma.vercel.app";
const OUT = `/tmp/pang-walk-${Date.now()}`;
mkdirSync(OUT, { recursive: true });

const findings = [];
const network = [];
const consoleMsgs = [];

function record(severity, step, summary, detail) {
  findings.push({ severity, step, summary, detail });
  process.stdout.write(
    `[${severity}] ${step}: ${summary}${detail ? "\n   " + detail : ""}\n`,
  );
}

async function snap(page, label) {
  const path = join(OUT, `${String(findings.length).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function logSummary() {
  const summary = {
    base: BASE,
    findings,
    network: network.filter((n) => n.status >= 400 || n.failed),
    consoleErrors: consoleMsgs.filter((m) => m.type === "error"),
    consoleWarnings: consoleMsgs.filter((m) => m.type === "warning"),
  };
  writeFileSync(join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  process.stdout.write(`\n--- Walk complete ---\n`);
  process.stdout.write(`Report: ${OUT}/report.json\n`);
  process.stdout.write(`Findings: ${findings.length}\n`);
  for (const sev of ["P0", "P1", "P2", "INFO"]) {
    const count = findings.filter((f) => f.severity === sev).length;
    if (count) process.stdout.write(`  ${sev}: ${count}\n`);
  }
}

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  permissions: ["camera"],
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();

page.on("pageerror", (e) => {
  record("P0", "pageerror", e.message, e.stack?.split("\n").slice(0, 4).join("\n"));
});
page.on("console", (m) => {
  consoleMsgs.push({ type: m.type(), text: m.text() });
  if (m.type() === "error" && !m.text().includes("eval()")) {
    record("P1", "console.error", m.text().slice(0, 200));
  }
});
page.on("response", (r) => {
  network.push({ url: r.url(), status: r.status(), failed: false });
  if (r.status() >= 400 && !r.url().includes("/_next/static/")) {
    record("P1", "network", `${r.status()} ${r.request().method()} ${r.url()}`);
  }
});
page.on("requestfailed", (r) => {
  network.push({ url: r.url(), status: 0, failed: true, failure: r.failure()?.errorText });
  record("P1", "requestfailed", `${r.url()} :: ${r.failure()?.errorText}`);
});

try {
  // Step 1: cold-install Room
  process.stdout.write(`\n=== Step 1: cold-install Room (${BASE}/) ===\n`);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);
  await snap(page, "01-room-cold");
  const main = await page.locator('main[aria-label="Your collection"]').count();
  if (!main) record("P0", "Room", "no <main aria-label='Your collection'> on cold install");

  const scanBtn = await page.locator('[data-testid="pang-room-scan-trigger"]').count();
  if (!scanBtn) record("P0", "Room", "scan trigger not visible on empty Room");

  const settingsBtn = await page.locator('[data-testid="pang-settings-trigger"]').count();
  if (!settingsBtn) record("P1", "Room", "settings trigger not visible");

  // Step 2: navigate to /scan
  process.stdout.write(`\n=== Step 2: tap scan trigger → /scan ===\n`);
  await page.locator('[data-testid="pang-room-scan-trigger"]').first().click({ timeout: 5000 });
  await page.waitForURL("**/scan", { timeout: 5000 });
  await page.waitForTimeout(2500);
  await snap(page, "02-scan-mounted");

  // Look for a viewfinder element OR a failed-state line
  const viewfinder = await page.locator('video, canvas, [data-testid*="viewfinder"]').count();
  const failedText = await page.locator("text=/camera|reshoot|did not/i").count();
  if (failedText > 0) {
    record("P1", "scan", "scan landed in failed state (camera unavailable in headless?)", await page.locator("body").innerText().then((t) => t.slice(0, 200)));
  }
  if (viewfinder === 0 && failedText === 0) {
    record("P0", "scan", "/scan rendered without viewfinder OR failed state — page may have crashed");
  }

  // Step 3: try to find capture-trigger (auto-capture happens after rectangle detected)
  process.stdout.write(`\n=== Step 3: wait for capture/arrival ===\n`);
  // Wait up to 15s for any of: arrival surface, review surface, failed state
  const outcome = await Promise.race([
    page.waitForSelector('text=/the gallery|reshoot/i', { timeout: 15000 }).then(() => "voice-line").catch(() => null),
    page.waitForSelector('[aria-label*="arrival" i], [data-stage="arrival"], [data-stage="review"]', { timeout: 15000 }).then(() => "stage").catch(() => null),
  ]);
  await snap(page, "03-after-capture-wait");
  if (!outcome) {
    record("P1", "scan", "no capture/arrival/review/failed state appeared within 15s — auto-capture may not fire on fake camera");
  } else {
    record("INFO", "scan", `outcome reached: ${outcome}`);
  }

  // Step 4: check API behavior anonymously
  process.stdout.write(`\n=== Step 4: probe API endpoints ===\n`);
  const probes = [
    { method: "POST", path: "/api/intake", expect: [400, 415, 422] },
    { method: "POST", path: "/api/verification/request", expect: [400, 422] },
    { method: "POST", path: "/api/verification/dispatch", expect: [400, 422] },
    { method: "GET", path: "/api/narrative/current", expect: [200, 204, 401] },
    { method: "GET", path: "/api/auth/session", expect: [200, 401] },
  ];
  for (const p of probes) {
    const res = await page.request.fetch(`${BASE}${p.path}`, {
      method: p.method,
      headers: { "content-type": p.method === "POST" ? "application/json" : "*/*" },
    });
    const ok = p.expect.includes(res.status());
    if (!ok) {
      record("P1", "api-probe", `${p.method} ${p.path} → ${res.status()} (expected one of ${p.expect.join(",")})`);
    } else {
      record("INFO", "api-probe", `${p.method} ${p.path} → ${res.status()} ✓`);
    }
  }

  // Step 5: head back to Room, check warm state
  process.stdout.write(`\n=== Step 5: warm-state Room reload ===\n`);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);
  await snap(page, "04-room-warm-reload");

  // Step 6: SW state
  process.stdout.write(`\n=== Step 6: SW + cache inspection ===\n`);
  const swState = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return { available: false };
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { available: true, registered: false };
    const cacheNames = await caches.keys();
    return {
      available: true,
      registered: true,
      scope: reg.scope,
      active: reg.active?.state,
      cacheNames,
    };
  });
  record("INFO", "sw", JSON.stringify(swState));
} catch (err) {
  record("P0", "walk-crash", err.message, err.stack?.split("\n").slice(0, 3).join("\n"));
} finally {
  await ctx.close();
  await browser.close();
  await logSummary();
}
