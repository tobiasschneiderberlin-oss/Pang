/**
 * PANG — client-safe API barrel.
 *
 * Type exports + the legacy mock-data surface from `lib/data.ts`.
 * Safe to import from any context (Server, Client, Edge).
 *
 * For Drizzle-backed reads, import from `@/lib/api/server` instead —
 * that barrel is `server-only` and pulls in postgres-js, which can't
 * cross the client boundary.
 *
 * Migration in progress: pages that have been converted to Server
 * Components import from `@/lib/api/server`. Pages still on the v0
 * mock layer keep importing from this barrel until they're touched.
 */

// Legacy mock-data surface — synchronous arrays + getters from lib/data.ts.
// Drop this re-export when the last importer migrates to @/lib/api/server.
export * from "../data";

// Type exports — safe to use from any boundary.
export type * from "./types";
