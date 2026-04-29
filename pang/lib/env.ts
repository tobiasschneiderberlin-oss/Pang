/**
 * PANG — environment variable schema + access.
 *
 * Single source of truth for which env vars exist, which are required,
 * and which are public (`NEXT_PUBLIC_*`) vs. server-only.
 *
 * Design rules:
 *   - All access goes through `serverEnv` (Node-only) or `publicEnv`
 *     (browser-safe). Direct `process.env` reads outside this file are
 *     a code smell.
 *   - Validation is at module load. A malformed env in prod throws at
 *     boot, not on first request.
 *   - Dev mode is forgiving: most vars are optional so `pnpm dev` works
 *     before Supabase / R2 / Anthropic are provisioned. Required-in-prod
 *     vars are enforced via a `.refine()` only when `NODE_ENV === "production"`.
 *   - Public vars (`NEXT_PUBLIC_*`) live in a separate object so a
 *     server-only secret cannot accidentally cross the boundary.
 *
 * Why hand-rolled, not @t3-oss/env-nextjs:
 *   - Single workspace, no monorepo glue needed.
 *   - We already use Zod everywhere; one less dep.
 *   - 60 lines is shorter than the t3-env config.
 */

import { z } from "zod";

const isProd = process.env["NODE_ENV"] === "production";

// ---------- Server schema ----------------------------------------
// Vars that must NEVER reach the client bundle.
// Required-in-prod fields use `.optional()` + a top-level `.superRefine()`
// so dev runs without secrets while prod fails fast.

const ServerEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // Auth secrets (PANG signed-link family).
    // Required in prod; in dev a fixed test value is used by lib/auth/config.ts.
    PANG_AUTH_RP_ID: z.string().optional(),
    PANG_AUTH_RP_NAME: z.string().default("PANG"),
    PANG_AUTH_ORIGINS: z.string().optional(), // comma-separated
    PANG_AUTH_INVITE_SECRET: z.string().min(32).optional(),
    PANG_AUTH_SESSION_SECRET: z.string().min(32).optional(),

    // Supabase server-only.
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    DATABASE_URL: z.string().url().optional(),

    // Anthropic + R2 + Helicone — server-side only.
    ANTHROPIC_API_KEY: z.string().optional(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    HELICONE_API_KEY: z.string().optional(),

    // Sentry server DSN (separate from public DSN).
    SENTRY_DSN: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    // Skip required-in-prod enforcement during `next build` (the build
    // phase runs with NODE_ENV=production but doesn't actually reach
    // any of these secrets — page data collection only). Runtime SSR /
    // edge / route handlers still validate at module load.
    if (process.env["NEXT_PHASE"] === "phase-production-build") return;

    // Required-in-production fields.
    const required: Array<keyof typeof env> = [
      "PANG_AUTH_INVITE_SECRET",
      "PANG_AUTH_SESSION_SECRET",
      "PANG_AUTH_RP_ID",
      "PANG_AUTH_ORIGINS",
      "SUPABASE_SERVICE_ROLE_KEY",
      "DATABASE_URL",
      "ANTHROPIC_API_KEY",
    ];

    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key as string],
          message: `${key as string} is required in production`,
        });
      }
    }

    if (
      env.PANG_AUTH_INVITE_SECRET &&
      env.PANG_AUTH_SESSION_SECRET &&
      env.PANG_AUTH_INVITE_SECRET === env.PANG_AUTH_SESSION_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PANG_AUTH_SESSION_SECRET"],
        message:
          "PANG_AUTH_SESSION_SECRET must differ from PANG_AUTH_INVITE_SECRET",
      });
    }
  });

// ---------- Public schema ----------------------------------------
// `NEXT_PUBLIC_*` vars only — these are inlined into the client bundle.

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:3000"),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),

  NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH: z.string().optional(),

  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z
    .string()
    .url()
    .default("https://eu.posthog.com"),

  // E2E seam — set during Playwright runs only.
  NEXT_PUBLIC_PANG_E2E: z.enum(["1", ""]).optional(),
});

// ---------- Parse + freeze ---------------------------------------

function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
  label: string,
): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`${label} validation failed:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Server env. Only call from Server Components, Server Actions, route
 * handlers, or scripts. Reading this from a Client Component will
 * include server secrets in the bundle — Next will block it, but don't
 * rely on the warning.
 */
export const serverEnv = parseOrThrow(
  ServerEnvSchema,
  process.env,
  "serverEnv",
);

/**
 * Public env. Safe to read from anywhere, including Client Components.
 * All values are guaranteed to be inlined into the client bundle.
 */
/** Coerce empty strings to undefined so Zod defaults + .optional() apply.
 *  An empty `NEXT_PUBLIC_FOO=` line in .env.local should be treated the
 *  same as the var being absent. */
const blank = (v: string | undefined): string | undefined =>
  v && v.length > 0 ? v : undefined;

export const publicEnv = parseOrThrow(
  PublicEnvSchema,
  {
    NEXT_PUBLIC_APP_URL: blank(process.env["NEXT_PUBLIC_APP_URL"]),
    NEXT_PUBLIC_SUPABASE_URL: blank(process.env["NEXT_PUBLIC_SUPABASE_URL"]),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: blank(
      process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    ),
    NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH: blank(
      process.env["NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH"],
    ),
    NEXT_PUBLIC_SENTRY_DSN: blank(process.env["NEXT_PUBLIC_SENTRY_DSN"]),
    NEXT_PUBLIC_POSTHOG_KEY: blank(process.env["NEXT_PUBLIC_POSTHOG_KEY"]),
    NEXT_PUBLIC_POSTHOG_HOST: blank(process.env["NEXT_PUBLIC_POSTHOG_HOST"]),
    NEXT_PUBLIC_PANG_E2E: blank(process.env["NEXT_PUBLIC_PANG_E2E"]),
  },
  "publicEnv",
);

/** Tagged-truth helper: `if (isProd)`. */
export const isProduction = serverEnv.NODE_ENV === "production";

/** True under Playwright E2E. Statically stripped from prod bundles. */
export const isE2E = publicEnv.NEXT_PUBLIC_PANG_E2E === "1";
