/**
 * PANG — Vitest config.
 *
 * Audit Day 3: test scaffolding. Today the test surface is small —
 * the harvested signed-link family + whatever lib/* utilities earn
 * their way in. Coverage is opt-in via `pnpm test -- --coverage`.
 *
 * Path alias mirrors `tsconfig.json` so `import "@/lib/..."` works
 * inside test files identical to inside app/components.
 */

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
    ],
    // Each test file runs in its own worker; the signed-link tests
    // mutate process-local state (.pang/server-signed-links) and can't
    // share across files safely.
    isolate: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
