-- PANG — RLS migration #1
--
-- Hand-authored. Drizzle Kit cannot express RLS, so this migration
-- runs AFTER 0000_*.sql to add:
--   1. The `collectors.id → auth.users(id)` FK (Drizzle doesn't
--      model Supabase's `auth` schema).
--   2. ENABLE ROW LEVEL SECURITY on every public table.
--   3. Deny-by-default policies — every allow case is explicit.
--   4. The `authenticated` role grants Supabase needs to honour the
--      policies (RLS only filters; the role still needs the verb).
--
-- Auth context for these policies is the collector PWA. Per ADR-001
-- Q1, gallery staff use a future separate auth context — their policies
-- get added in a later migration when that portal exists.

-- ============================================================
-- 1. Collectors → auth.users foreign key
-- ============================================================

ALTER TABLE "collectors"
  ADD CONSTRAINT "collectors_id_fk_auth_users"
  FOREIGN KEY ("id") REFERENCES auth.users(id)
  ON DELETE CASCADE;
--> statement-breakpoint

-- ============================================================
-- 2. Enable RLS on every public table
-- ============================================================

ALTER TABLE "galleries"                     ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collectors"                    ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collector_gallery_membership"  ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artist_profiles"               ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artworks"                      ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents"                     ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provenance_entries"            ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_requests"         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ============================================================
-- 3. Verb grants for `authenticated`
-- ============================================================
-- Supabase grants USAGE on the public schema to authenticated by
-- default but doesn't grant per-table verbs. RLS filters; verbs
-- still need to be present.

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "galleries",
  "collectors",
  "collector_gallery_membership",
  "artist_profiles",
  "artworks",
  "documents",
  "provenance_entries",
  "verification_requests"
TO authenticated;
--> statement-breakpoint

-- ============================================================
-- 4. Policies
-- ============================================================
-- Convention:
--   - `*_select_*`, `*_insert_*`, `*_update_*`, `*_delete_*`
--   - All scoped TO authenticated. Anon is rejected at the role
--     boundary; `auth.uid()` returns NULL for anon and every clause
--     that compares against it then yields NULL → row excluded.

-- ---------- galleries ---------------------------------------
-- SELECT: only galleries the calling user is a member of.
CREATE POLICY "galleries_select_member" ON "galleries"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "collector_gallery_membership" cgm
    WHERE cgm.gallery_id = galleries.id
      AND cgm.collector_id = auth.uid()
  )
);
--> statement-breakpoint
-- No INSERT/UPDATE/DELETE policies → those verbs require service_role
-- (used by gallery onboarding scripts and admin tooling).

-- ---------- collectors --------------------------------------
-- SELECT: own row.
CREATE POLICY "collectors_select_own" ON "collectors"
FOR SELECT TO authenticated
USING (id = auth.uid());
--> statement-breakpoint
-- SELECT: other collectors who share an artist (artist circle, Q4),
-- gated on `discoverable_in_circles`.
CREATE POLICY "collectors_select_circle" ON "collectors"
FOR SELECT TO authenticated
USING (
  discoverable_in_circles = true
  AND EXISTS (
    SELECT 1
    FROM "artworks" a1
    JOIN "artworks" a2 ON a1.artist_id = a2.artist_id
    WHERE a1.collector_id = auth.uid()
      AND a2.collector_id = collectors.id
      AND a1.artist_id IS NOT NULL
  )
);
--> statement-breakpoint
-- INSERT: signup row creation — only for self.
CREATE POLICY "collectors_insert_self" ON "collectors"
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());
--> statement-breakpoint
-- UPDATE: own row only; can't change id (the PK = FK invariant).
CREATE POLICY "collectors_update_own" ON "collectors"
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
--> statement-breakpoint
-- DELETE: own row only (account self-deletion). The `auth.users`
-- ON DELETE CASCADE will then clean every owned artwork/document.
CREATE POLICY "collectors_delete_own" ON "collectors"
FOR DELETE TO authenticated
USING (id = auth.uid());
--> statement-breakpoint

-- ---------- collector_gallery_membership --------------------
-- SELECT: own memberships only.
CREATE POLICY "cgm_select_own" ON "collector_gallery_membership"
FOR SELECT TO authenticated
USING (collector_id = auth.uid());
--> statement-breakpoint
-- UPDATE: own memberships only — used to flip
-- `hidden_from_gallery` privacy flag (Q2).
CREATE POLICY "cgm_update_own" ON "collector_gallery_membership"
FOR UPDATE TO authenticated
USING (collector_id = auth.uid())
WITH CHECK (collector_id = auth.uid());
--> statement-breakpoint
-- INSERT/DELETE: service_role only (invite-bind + tear-down flows).

-- ---------- artist_profiles ---------------------------------
-- SELECT: visible to any member of the artist's issuing gallery.
CREATE POLICY "artist_profiles_select_member" ON "artist_profiles"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "collector_gallery_membership" cgm
    WHERE cgm.gallery_id = artist_profiles.gallery_id
      AND cgm.collector_id = auth.uid()
  )
);
--> statement-breakpoint
-- INSERT/UPDATE/DELETE: gallery-staff context (future portal). No
-- collector policy → service_role only for now.

-- ---------- artworks ----------------------------------------
-- v1 visibility: collector sees only their own. The "shared" /
-- "public" tiers are deferred until the privacy UX is designed.
CREATE POLICY "artworks_select_own" ON "artworks"
FOR SELECT TO authenticated
USING (collector_id = auth.uid());
--> statement-breakpoint
-- INSERT: caller becomes the owner; gallery_id must be one they're
-- a member of (multi-tenant guard, Q3).
CREATE POLICY "artworks_insert_own" ON "artworks"
FOR INSERT TO authenticated
WITH CHECK (
  collector_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM "collector_gallery_membership" cgm
    WHERE cgm.gallery_id = artworks.gallery_id
      AND cgm.collector_id = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "artworks_update_own" ON "artworks"
FOR UPDATE TO authenticated
USING (collector_id = auth.uid())
WITH CHECK (collector_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "artworks_delete_own" ON "artworks"
FOR DELETE TO authenticated
USING (collector_id = auth.uid());
--> statement-breakpoint

-- ---------- documents ---------------------------------------
-- Same own-only pattern. The CHECK constraint on the table forbids
-- `sensitivity_tier = 'locked'` when any retrievability flag is set
-- (ADR-003); RLS doesn't need to repeat that.
CREATE POLICY "documents_select_own" ON "documents"
FOR SELECT TO authenticated
USING (collector_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "documents_insert_own" ON "documents"
FOR INSERT TO authenticated
WITH CHECK (
  collector_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM "artworks" a
    WHERE a.id = documents.artwork_id
      AND a.collector_id = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "documents_update_own" ON "documents"
FOR UPDATE TO authenticated
USING (collector_id = auth.uid())
WITH CHECK (collector_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "documents_delete_own" ON "documents"
FOR DELETE TO authenticated
USING (collector_id = auth.uid());
--> statement-breakpoint

-- ---------- provenance_entries ------------------------------
-- Append-only by design (Q2): SELECT + INSERT only. No UPDATE/DELETE
-- policies — those verbs are denied to authenticated even though
-- the GRANT above included them. (RLS without a matching policy
-- = deny.)
CREATE POLICY "provenance_select_via_artwork" ON "provenance_entries"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "artworks" a
    WHERE a.id = provenance_entries.artwork_id
      AND a.collector_id = auth.uid()
  )
);
--> statement-breakpoint
CREATE POLICY "provenance_insert_via_artwork" ON "provenance_entries"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "artworks" a
    WHERE a.id = provenance_entries.artwork_id
      AND a.collector_id = auth.uid()
  )
);
--> statement-breakpoint

-- ---------- verification_requests ---------------------------
-- Collector creates the request and reads its status. The flip from
-- 'pending' to 'confirmed'/'declined' happens via the future gallery
-- portal context — collectors cannot UPDATE or DELETE their own
-- requests once dispatched (would defeat the verification trust
-- layer). Hence no UPDATE/DELETE policies.
CREATE POLICY "vr_select_own" ON "verification_requests"
FOR SELECT TO authenticated
USING (collector_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "vr_insert_own" ON "verification_requests"
FOR INSERT TO authenticated
WITH CHECK (
  collector_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM "artworks" a
    WHERE a.id = verification_requests.artwork_id
      AND a.collector_id = auth.uid()
  )
);
--> statement-breakpoint

-- ============================================================
-- 5. Updated-at maintenance
-- ============================================================
-- Bump `updated_at` automatically on UPDATE for tables that have it.
-- Cheap belt-and-braces: callers should also set it in their UPDATE
-- statement, but the trigger backstops accidents.

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER artist_profiles_set_updated_at
  BEFORE UPDATE ON "artist_profiles"
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
--> statement-breakpoint

CREATE TRIGGER artworks_set_updated_at
  BEFORE UPDATE ON "artworks"
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
--> statement-breakpoint

CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
--> statement-breakpoint

-- ============================================================
-- 6. Performance helpers
-- ============================================================
-- The `collectors_select_circle` policy joins through `artworks`
-- twice on `(artist_id, collector_id)`. Index that combo so it
-- stays cheap.

CREATE INDEX IF NOT EXISTS "artworks_artist_id_collector_id_idx"
  ON "artworks" ("artist_id", "collector_id")
  WHERE "artist_id" IS NOT NULL;
--> statement-breakpoint

-- The `cgm_select_own` and several `EXISTS` checks scan
-- `collector_gallery_membership` by `collector_id`. The PK already
-- covers `(collector_id, gallery_id)` — that's a covering index for
-- collector-id-first lookups, no additional index needed.
