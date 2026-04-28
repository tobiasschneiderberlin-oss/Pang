/**
 * PANG — Drizzle Kit config.
 *
 * Loads .env.local via Node 22's native `process.loadEnvFile()` so
 * `pnpm db:*` scripts work without --env-file or dotenv. In CI /
 * Vercel, env vars are already set; the load is a no-op when the
 * file is absent.
 */

import { defineConfig } from "drizzle-kit";

if (process.env.NODE_ENV !== "production") {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local — assume CI / Vercel has DATABASE_URL set already.
  }
}

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Populate pang/.env.local or your environment.",
  );
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  // Print every generated statement during `drizzle-kit generate`/`migrate`.
  // In a multi-tenant project the visibility is worth the noise.
  verbose: true,
  strict: true,
  // Don't introspect Supabase's internal schemas. We only manage `public`.
  schemaFilter: ["public"],
});
