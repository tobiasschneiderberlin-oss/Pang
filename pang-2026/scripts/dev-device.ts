#!/usr/bin/env tsx
/**
 * PANG — dev:device.
 *
 * One script to stop the push-to-Vercel-to-test-on-phone loop.
 *
 * What it does:
 *   1. Detects this machine's LAN IPv4 address.
 *   2. Spawns `next dev --turbopack --experimental-https -H 0.0.0.0`
 *      so a phone on the same Wi-Fi can reach the dev server over TLS.
 *      PWA features (camera, service worker, OPFS) require a secure
 *      context; plain http://192.168.x over LAN is rejected by Chrome.
 *   3. Prints a QR code the phone can scan + the literal URL so you
 *      can type it if QR is inconvenient.
 *   4. Prints the cert-trust steps once so you know what to do the
 *      first time Chrome on the phone shouts about the self-signed
 *      certificate.
 *
 * Usage:
 *   npm run dev:device
 *
 * Caveats:
 *   - Next 16's `--experimental-https` writes a self-signed cert to
 *     `./certificates/`. Android Chrome will show the interstitial
 *     warning once per session — tap "Advanced" → "Proceed to
 *     <ip> (unsafe)". Camera + OPFS then work. For zero-warning, run
 *     mkcert locally and install the root on the phone; that's Tier
 *     4.5 (not in scope today).
 *   - Firewall on macOS may prompt to allow incoming connections.
 *     Accept once.
 */

import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
// qrcode-terminal has no bundled types; an ambient declaration lives
// in scripts/types/qrcode-terminal.d.ts.
import qrcode from "qrcode-terminal";

// ---------- LAN IP detection --------------------------------------

function detectLanAddress(): string | null {
  const ifaces = networkInterfaces();
  // Prefer a non-internal IPv4 on a physical adapter. macOS typically
  // names Wi-Fi `en0`; Linux varies. We scan all, skipping virtual
  // interfaces (Docker, VPN tunnels).
  const skipPrefixes = ["lo", "docker", "utun", "tun", "tailscale"];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    if (skipPrefixes.some((p) => name.toLowerCase().startsWith(p))) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

// ---------- Main --------------------------------------------------

async function main(): Promise<void> {
  const lanIp = detectLanAddress();
  const port = process.env["PORT"] ?? "3000";

  if (!lanIp) {
    console.error(
      "[dev:device] no LAN IPv4 found — are you connected to a network?",
    );
    process.exit(1);
  }

  const url = `https://${lanIp}:${port}`;

  // Header banner.
  console.log("");
  console.log("\x1b[2m──────────────────────────────────────────────\x1b[0m");
  console.log(`\x1b[1m PANG dev — device mode\x1b[0m`);
  console.log(`\x1b[2m LAN URL:\x1b[0m ${url}`);
  console.log(`\x1b[2m Scan the QR with the camera app on the phone.\x1b[0m`);
  console.log(
    `\x1b[2m First time: Chrome shows an \"unsafe\" warning — tap\x1b[0m`,
  );
  console.log(
    `\x1b[2m Advanced → Proceed. Camera + OPFS work after that.\x1b[0m`,
  );
  console.log("\x1b[2m──────────────────────────────────────────────\x1b[0m");
  console.log("");

  // QR. `small: true` uses half-height ANSI blocks so the code fits
  // in a standard terminal without wrapping.
  await new Promise<void>((resolve) => {
    qrcode.generate(url, { small: true }, (ascii) => {
      console.log(ascii);
      resolve();
    });
  });

  console.log("");
  console.log(`  ${url}`);
  console.log("");

  // Hand off to `next dev`. `-H 0.0.0.0` binds every interface so the
  // phone can reach us over Wi-Fi. `--experimental-https` makes Next
  // provision a self-signed cert (written to ./certificates/ — first
  // run only).
  const child = spawn(
    "npx",
    [
      "next",
      "dev",
      "--turbopack",
      "--experimental-https",
      "-H",
      "0.0.0.0",
      "-p",
      port,
    ],
    { stdio: "inherit" },
  );

  // Forward termination signals so Ctrl-C cleanly kills next dev.
  const forwardSignal = (sig: NodeJS.Signals) => () => {
    if (!child.killed) child.kill(sig);
  };
  process.on("SIGINT", forwardSignal("SIGINT"));
  process.on("SIGTERM", forwardSignal("SIGTERM"));

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

void main();
