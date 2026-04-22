/**
 * PANG — root layout.
 *
 * Server component. No client-side state here. The client-side
 * preferences binding and service-worker registration happen in the
 * `<AppBoot>` island mounted below.
 *
 * Metadata is explicit — Next.js 16 generates `<meta>` tags and the
 * manifest link automatically from this object. Theme-color is
 * dual (light/dark) so iOS Safari tints the status bar correctly.
 */

import type { Metadata, Viewport } from "next";
import type { ReactElement, ReactNode } from "react";
import { headers } from "next/headers";
import {
  FONT_PRECONNECT_ORIGIN,
  FONT_STYLESHEET_HREF,
} from "@design/fonts";
import { AppBoot } from "@/components/AppBoot";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PANG",
    template: "%s — PANG",
  },
  description: "Your collection as a space.",
  applicationName: "PANG",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PANG",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#101114" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  // The proxy sets `x-nonce` on every HTML navigation; Next.js
  // stamps its own `<script>` tags automatically, but any <link>
  // or <style> we author should carry the nonce explicitly so the
  // style-src 'nonce-…' atom admits it without an `'unsafe-inline'`
  // escape hatch.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fonts — Instrument Serif + Geist + Geist Mono (DS Ch. 03).
            preconnect keeps the first paint fast; tokens.css
            consumes the literal family names globally.

            `suppressHydrationWarning` on the stylesheet link: the
            `nonce` attribute is server-only (the client bundle has
            no access to request headers), so hydration always sees
            a server-vs-client diff on that attr. The browser has
            already admitted the stylesheet at parse time using the
            server-rendered nonce; React's reconciliation of the
            attribute is cosmetic. Documented escape hatch for
            server-only props. Silences the noisy warning without
            widening the CSP (P6 stays strict). */}
        <link
          rel="preconnect"
          href={FONT_PRECONNECT_ORIGIN}
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href={FONT_STYLESHEET_HREF}
          nonce={nonce}
          suppressHydrationWarning
        />
      </head>
      <body>
        {children}
        <AppBoot />
      </body>
    </html>
  );
}
