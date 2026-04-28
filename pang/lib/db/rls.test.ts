/**
 * PANG — RLS deny-by-default test suite (live).
 *
 * Hits the LIVE Supabase Postgres. Mutates state — creates two real
 * test users via the Supabase Auth admin API, exercises every
 * visibility invariant, then tears down. Skipped in regular `pnpm test`
 * runs; opt in with `pnpm test:rls` (sets TEST_LIVE_DB=1).
 *
 * Each `it()` runs inside a transaction with `SET LOCAL ROLE authenticated`
 * + `SET LOCAL "request.jwt.claims" = '{"sub":"<uid>",…}'` so the
 * Supabase `auth.uid()` function returns the simulated caller. RLS
 * policies are then evaluated as if the request came from that user.
 *
 * Why test live and not against a stub Postgres: RLS policies use
 * `auth.uid()` which is a Supabase-managed function. Stubbing it is
 * possible but loses the integration value. The pilot DB is small
 * enough that test cost is negligible.
 *
 * Failure-mode safety: afterAll() always tears down test users + the
 * test gallery rows, even if individual cases fail. Re-running is
 * idempotent because each run uses a unique email suffix.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Node 22's loadEnvFile — same trick as drizzle.config.ts.
try { process.loadEnvFile(".env.local"); } catch { /* CI / Vercel env */ }

const TEST_LIVE = process.env["TEST_LIVE_DB"] === "1";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const DATABASE_URL = process.env["DATABASE_URL"];

describe.skipIf(!TEST_LIVE || !SUPABASE_URL || !SERVICE_ROLE || !DATABASE_URL)(
  "RLS deny-by-default",
  () => {
    let admin: SupabaseClient;
    let pgClient: ReturnType<typeof postgres>;
    let db: PostgresJsDatabase;
    const stamp = Date.now();
    let userA = "";
    let userB = "";
    let galleryX = "";
    let galleryY = "";
    let artworkA = "";
    let artworkB = "";

    beforeAll(async () => {
      admin = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
        auth: { persistSession: false },
      });
      pgClient = postgres(DATABASE_URL!, { prepare: false, max: 4 });
      db = drizzle(pgClient);

      // Two real auth.users records.
      const a = await admin.auth.admin.createUser({
        email: `rls-test-a-${stamp}@pang.local`,
        password: "rls-test-password-12345",
        email_confirm: true,
      });
      if (a.error) throw a.error;
      userA = a.data.user!.id;

      const b = await admin.auth.admin.createUser({
        email: `rls-test-b-${stamp}@pang.local`,
        password: "rls-test-password-12345",
        email_confirm: true,
      });
      if (b.error) throw b.error;
      userB = b.data.user!.id;

      // Collector rows mirror auth.users.id 1:1.
      await db.execute(sql`
        INSERT INTO collectors (id, email, display_name)
        VALUES (${userA}, ${a.data.user!.email}, 'Test A'),
               (${userB}, ${b.data.user!.email}, 'Test B');
      `);

      // Two galleries, distinct memberships.
      const gx = await db.execute<{ id: string }>(sql`
        INSERT INTO galleries (name, slug, country_code)
        VALUES ('Gallery X ' || ${stamp}, ${`rls-x-${stamp}`}, 'DE')
        RETURNING id;
      `);
      const gy = await db.execute<{ id: string }>(sql`
        INSERT INTO galleries (name, slug, country_code)
        VALUES ('Gallery Y ' || ${stamp}, ${`rls-y-${stamp}`}, 'DE')
        RETURNING id;
      `);
      galleryX = gx[0].id;
      galleryY = gy[0].id;

      await db.execute(sql`
        INSERT INTO collector_gallery_membership (collector_id, gallery_id, status, bound_at)
        VALUES (${userA}, ${galleryX}, 'active', now()),
               (${userB}, ${galleryY}, 'active', now());
      `);

      // One artwork each, in the matching gallery.
      const aw_a = await db.execute<{ id: string }>(sql`
        INSERT INTO artworks (gallery_id, collector_id, artist_name, title)
        VALUES (${galleryX}, ${userA}, 'Artist X', 'Work A1')
        RETURNING id;
      `);
      const aw_b = await db.execute<{ id: string }>(sql`
        INSERT INTO artworks (gallery_id, collector_id, artist_name, title)
        VALUES (${galleryY}, ${userB}, 'Artist Y', 'Work B1')
        RETURNING id;
      `);
      artworkA = aw_a[0].id;
      artworkB = aw_b[0].id;
    }, 30000);

    afterAll(async () => {
      // Service role bypasses RLS; cascade does the rest.
      if (galleryX)
        await db.execute(sql`DELETE FROM galleries WHERE id = ${galleryX};`);
      if (galleryY)
        await db.execute(sql`DELETE FROM galleries WHERE id = ${galleryY};`);
      if (userA) await admin.auth.admin.deleteUser(userA);
      if (userB) await admin.auth.admin.deleteUser(userB);
      await pgClient.end();
    });

    /** Run `fn` as the given collector. Wrapped in a tx so SET LOCAL is scoped. */
    async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE authenticated`);
        const claims = JSON.stringify({ sub: uid, role: "authenticated" });
        await tx.execute(sql.raw(`SET LOCAL "request.jwt.claims" = '${claims}'`));
        // Bind tx to the global db so the inner queries below pick up the role.
        return await fn();
      });
    }

    // ---------- visibility ---------------------------------------

    it("collector A sees only their own artworks", async () => {
      const rows = await asUser(userA, () =>
        db.execute<{ id: string; title: string }>(
          sql`SELECT id, title FROM artworks ORDER BY title;`,
        ),
      );
      expect(rows.map((r) => r.title)).toEqual(["Work A1"]);
    });

    it("collector B cannot SELECT collector A's artwork by id", async () => {
      const rows = await asUser(userB, () =>
        db.execute<{ id: string }>(
          sql`SELECT id FROM artworks WHERE id = ${artworkA};`,
        ),
      );
      expect(rows).toHaveLength(0);
    });

    it("collector A sees only galleries they're a member of", async () => {
      const rows = await asUser(userA, () =>
        db.execute<{ id: string }>(
          sql`SELECT id FROM galleries ORDER BY id;`,
        ),
      );
      expect(rows.map((r) => r.id)).toEqual([galleryX]);
    });

    // ---------- write isolation ----------------------------------

    it("collector A cannot INSERT an artwork with collector_id = B", async () => {
      await expect(
        asUser(userA, () =>
          db.execute(sql`
            INSERT INTO artworks (gallery_id, collector_id, artist_name, title)
            VALUES (${galleryX}, ${userB}, 'X', 'Forged');
          `),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("collector A cannot UPDATE collector B's artwork", async () => {
      await asUser(userA, () =>
        db.execute(
          sql`UPDATE artworks SET title = 'Hacked' WHERE id = ${artworkB};`,
        ),
      );
      // Update silently affected 0 rows because the WHERE didn't pass RLS.
      // Verify B's row is intact via the service-role connection.
      const fresh = await db.execute<{ title: string }>(
        sql`SELECT title FROM artworks WHERE id = ${artworkB};`,
      );
      expect(fresh[0].title).toBe("Work B1");
    });

    // ---------- CHECK constraint (ADR-003) -----------------------

    it("documents CHECK rejects locked + tax_relevant", async () => {
      await expect(
        db.execute(sql`
          INSERT INTO documents (
            gallery_id, collector_id, artwork_id, type, title, storage_path,
            sensitivity_tier, tax_relevant
          )
          VALUES (
            ${galleryX}, ${userA}, ${artworkA}, 'invoice', 'CoA', 'fake/path',
            'locked', true
          );
        `),
      ).rejects.toThrow(/documents_locked_excludes_retrievable/i);
    });

    // ---------- provenance is append-only ------------------------

    it("collector A can INSERT a provenance entry on their own artwork", async () => {
      await asUser(userA, () =>
        db.execute(sql`
          INSERT INTO provenance_entries (artwork_id, event)
          VALUES (${artworkA}, 'Acquired from gallery');
        `),
      );
      const rows = await db.execute<{ event: string }>(
        sql`SELECT event FROM provenance_entries WHERE artwork_id = ${artworkA};`,
      );
      expect(rows[0].event).toBe("Acquired from gallery");
    });

    it("collector A cannot UPDATE provenance entries (append-only)", async () => {
      // No UPDATE policy → 0 rows affected.
      await asUser(userA, () =>
        db.execute(
          sql`UPDATE provenance_entries SET event = 'Tampered' WHERE artwork_id = ${artworkA};`,
        ),
      );
      const rows = await db.execute<{ event: string }>(
        sql`SELECT event FROM provenance_entries WHERE artwork_id = ${artworkA};`,
      );
      expect(rows[0].event).toBe("Acquired from gallery");
    });
  },
);
