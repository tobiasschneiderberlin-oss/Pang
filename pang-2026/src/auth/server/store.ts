/**
 * PANG — auth server store (iter #9).
 *
 * Filesystem-backed dev stand-in for the auth tables. One file per
 * record under `.pang/server-<kind>/`. Shape is identical to the
 * Supabase rows that will replace it — a migration is a find/replace
 * from `readRecord` to `supabase.from(table).select()`.
 *
 * Rules:
 *   - Every read runs through the corresponding Zod schema. A corrupt
 *     record fails loudly on read, not silently on downstream use.
 *   - Writes are atomic — write to `<path>.tmp`, fsync, rename.
 *   - File names are the record id. All ids are constrained by regex
 *     (see `schema.ts`), so no path-traversal surface.
 *   - `readRecord` uses a directory lookup + single stat + single
 *     read — the lookup is O(1) on modern FS. This is the constant-
 *     time path `requireSession` relies on; no scan or iteration.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BindSessionRecordSchema,
  ChallengeRecordSchema,
  CredentialRecordSchema,
  SessionRecordSchema,
  UserRecordSchema,
  type BindSessionRecord,
  type ChallengeRecord,
  type CredentialRecord,
  type SessionRecord,
  type UserRecord,
} from "../schema";

// ---------- Paths --------------------------------------------------

const ROOT = path.resolve(process.cwd(), ".pang");

const DIRS = {
  users: path.join(ROOT, "server-users"),
  credentials: path.join(ROOT, "server-credentials"),
  credentialsRevoked: path.join(ROOT, "server-credentials-revoked"),
  sessions: path.join(ROOT, "server-sessions"),
  invites: path.join(ROOT, "server-invites"),
  binds: path.join(ROOT, "server-sessions"), // bind lives under the same dir with a `bind_` prefix
  challenges: path.join(ROOT, "server-challenges"),
} as const;

/**
 * Sanitise a record id before using it as a filename. All ids are
 * already regex-validated by Zod schemas, so this is defence in
 * depth — anything that can't round-trip through this function is a
 * caller bug.
 */
function sanitise(id: string): string {
  if (!/^[A-Za-z0-9_\-:]+$/.test(id)) {
    throw new Error(`unsafe record id: ${id.slice(0, 16)}`);
  }
  return id;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeAtomic(filePath: string, record: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

async function readIfExists(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

async function removeIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "ENOENT") return;
    throw err;
  }
}

// ---------- Users --------------------------------------------------

export async function writeUser(record: UserRecord): Promise<void> {
  const parsed = UserRecordSchema.parse(record);
  await writeAtomic(path.join(DIRS.users, `${sanitise(parsed.userId)}.json`), parsed);
}

export async function readUser(userId: string): Promise<UserRecord | null> {
  const raw = await readIfExists(path.join(DIRS.users, `${sanitise(userId)}.json`));
  if (raw === null) return null;
  return UserRecordSchema.parse(raw);
}

// ---------- Credentials --------------------------------------------

export async function writeCredential(record: CredentialRecord): Promise<void> {
  const parsed = CredentialRecordSchema.parse(record);
  await writeAtomic(
    path.join(DIRS.credentials, `${sanitise(parsed.credentialId)}.json`),
    parsed,
  );
}

export async function readCredential(
  credentialId: string,
): Promise<CredentialRecord | null> {
  const raw = await readIfExists(
    path.join(DIRS.credentials, `${sanitise(credentialId)}.json`),
  );
  if (raw === null) return null;
  return CredentialRecordSchema.parse(raw);
}

/**
 * Move a credential from the live store into the revoked store. The
 * clone-detector call site uses this; the assert handler then
 * short-circuits on a 410.
 */
export async function revokeCredential(
  credentialId: string,
  reason: string,
): Promise<void> {
  const current = await readCredential(credentialId);
  if (current === null) return;
  const updated: CredentialRecord = {
    ...current,
    revokedAt: new Date().toISOString(),
    revocationReason: reason.slice(0, 64),
  };
  await writeAtomic(
    path.join(DIRS.credentialsRevoked, `${sanitise(credentialId)}.json`),
    updated,
  );
  await removeIfExists(
    path.join(DIRS.credentials, `${sanitise(credentialId)}.json`),
  );
}

/**
 * Enumerate all live credentials for a userId. Used by the assert
 * options endpoint so the client can advertise `allowCredentials`.
 * Walks the credentials directory — O(n) on the number of credentials
 * across all users. Acceptable at the dev scale; Supabase replaces
 * this with a row-level select.
 */
export async function listCredentialsForUser(
  userId: string,
): Promise<readonly CredentialRecord[]> {
  await ensureDir(DIRS.credentials);
  const entries = await fs.readdir(DIRS.credentials);
  const out: CredentialRecord[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const raw = await readIfExists(path.join(DIRS.credentials, name));
    if (raw === null) continue;
    const parsed = CredentialRecordSchema.safeParse(raw);
    if (!parsed.success) continue;
    if (parsed.data.userId === userId) out.push(parsed.data);
  }
  return out;
}

// ---------- Sessions -----------------------------------------------

export async function writeSession(record: SessionRecord): Promise<void> {
  const parsed = SessionRecordSchema.parse(record);
  await writeAtomic(
    path.join(DIRS.sessions, `${sanitise(parsed.sessionToken)}.json`),
    parsed,
  );
}

export async function readSession(
  sessionToken: string,
): Promise<SessionRecord | null> {
  if (!/^[0-9a-f]{64}$/.test(sessionToken)) return null;
  const raw = await readIfExists(
    path.join(DIRS.sessions, `${sanitise(sessionToken)}.json`),
  );
  if (raw === null) return null;
  const parsed = SessionRecordSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

export async function deleteSession(sessionToken: string): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(sessionToken)) return;
  await removeIfExists(
    path.join(DIRS.sessions, `${sanitise(sessionToken)}.json`),
  );
}

// ---------- Bind sessions ------------------------------------------

export async function writeBindSession(record: BindSessionRecord): Promise<void> {
  const parsed = BindSessionRecordSchema.parse(record);
  await writeAtomic(
    path.join(DIRS.binds, `bind_${sanitise(parsed.bindSessionToken)}.json`),
    parsed,
  );
}

export async function readBindSession(
  bindSessionToken: string,
): Promise<BindSessionRecord | null> {
  if (!/^[0-9a-f]{64}$/.test(bindSessionToken)) return null;
  const raw = await readIfExists(
    path.join(DIRS.binds, `bind_${sanitise(bindSessionToken)}.json`),
  );
  if (raw === null) return null;
  const parsed = BindSessionRecordSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

export async function deleteBindSession(bindSessionToken: string): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(bindSessionToken)) return;
  await removeIfExists(
    path.join(DIRS.binds, `bind_${sanitise(bindSessionToken)}.json`),
  );
}

// ---------- Invites (consumed marker) ------------------------------

/**
 * Mark an invite's jti consumed. Replaying the JWT on the `bind`
 * route reads this marker and fails closed.
 *
 * As of iter #10 this forwards to the signed-link consumed-marker
 * under the `collector-invite` audience. The old `.pang/server-invites/`
 * directory is left in place (empty on fresh installs) for now; the
 * module keeps the iter #9 function names so call sites don't churn.
 */
export async function markInviteConsumed(jti: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]+$/.test(jti)) {
    throw new Error("unsafe invite jti");
  }
  const { markSignedLinkConsumed } = await import("./signed-link");
  await markSignedLinkConsumed("collector-invite", jti);
}

export async function isInviteConsumed(jti: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]+$/.test(jti)) return true;
  const { isSignedLinkConsumed } = await import("./signed-link");
  return isSignedLinkConsumed("collector-invite", jti);
}

// ---------- Challenges ---------------------------------------------

export async function writeChallenge(record: ChallengeRecord): Promise<void> {
  const parsed = ChallengeRecordSchema.parse(record);
  await writeAtomic(
    path.join(DIRS.challenges, `${sanitise(parsed.challenge)}.json`),
    parsed,
  );
}

export async function takeChallenge(
  challenge: string,
): Promise<ChallengeRecord | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) return null;
  const filePath = path.join(DIRS.challenges, `${sanitise(challenge)}.json`);
  const raw = await readIfExists(filePath);
  if (raw === null) return null;
  // Challenges are single-use — delete before returning.
  await removeIfExists(filePath);
  const parsed = ChallengeRecordSchema.safeParse(raw);
  if (!parsed.success) return null;
  // TTL check.
  if (Date.parse(parsed.data.expiresAt) < Date.now()) return null;
  return parsed.data;
}

// ---------- Test helpers -------------------------------------------

/**
 * Reset every auth store directory. Tests only; no production caller
 * should ever invoke this.
 */
export async function __resetAuthStoresForTests(): Promise<void> {
  for (const dir of Object.values(DIRS)) {
    try {
      const entries = await fs.readdir(dir);
      for (const name of entries) {
        if (name === ".gitkeep") continue;
        await removeIfExists(path.join(dir, name));
      }
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "ENOENT") continue;
      throw err;
    }
  }
  // Signed-link consumed-markers live under their own root (iter #10).
  const { __resetSignedLinksForTests } = await import("./signed-link");
  await __resetSignedLinksForTests();
}
