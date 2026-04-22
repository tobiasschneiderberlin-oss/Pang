/**
 * PANG — OPFS bootstrap.
 *
 * Origin-Private File System is where staged intakes, cached
 * thumbnails, and the offline work cache live (Architecture doc).
 * IndexedDB is reserved for structured records; OPFS for bytes.
 *
 * This module guarantees the directory layout the rest of the app
 * assumes exists. It is idempotent and cheap to call on every cold
 * load.
 *
 *   /intake/staged/       — untrusted captures awaiting confirmation
 *   /intake/redacted/     — post-`sanitize()` canonical PNGs
 *   /thumbnails/          — worker-generated thumbnails for The Room
 *   /documents/           — scanned certificates, invoices
 *   /tmp/                 — transient; cleared on boot
 *
 * P5 asserts the bootstrap runs on first paint and the directory
 * handles are accessible. Persistent storage is requested best-effort
 * — Safari granted it by default in 26+, Chromium via
 * `navigator.storage.persist()` (no prompt; heuristic-based).
 */

const DIRECTORIES = [
  "intake",
  "intake/staged",
  "intake/redacted",
  "thumbnails",
  "documents",
  "tmp",
] as const;

export async function bootstrapOpfs(): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!navigator.storage || !("getDirectory" in navigator.storage)) return;

  try {
    const root = await navigator.storage.getDirectory();

    for (const path of DIRECTORIES) {
      await ensureDirectory(root, path);
    }

    await clearTmp(root);
    await requestPersistence();
  } catch {
    // Non-fatal. A reduced experience is better than a blocked boot.
    // Iteration #5 wires `pang.opfs.bootstrap.fail`.
  }
}

async function ensureDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  const parts = path.split("/");
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function clearTmp(root: FileSystemDirectoryHandle): Promise<void> {
  try {
    const tmp = await root.getDirectoryHandle("tmp", { create: true });
    // The async iterator is gated by a feature check because some
    // engines still return a generator-like object.
    const dir = tmp as FileSystemDirectoryHandle & {
      entries?: () => AsyncIterable<[string, FileSystemHandle]>;
    };
    if (typeof dir.entries !== "function") return;
    for await (const [name] of dir.entries()) {
      await tmp.removeEntry(name, { recursive: true }).catch(() => {});
    }
  } catch {
    // best-effort
  }
}

async function requestPersistence(): Promise<void> {
  try {
    if (
      navigator.storage &&
      "persist" in navigator.storage &&
      typeof navigator.storage.persist === "function"
    ) {
      // Heuristic grant on Chromium; Safari grants by default.
      await navigator.storage.persist();
    }
  } catch {
    // best-effort
  }
}

/**
 * Read/write helpers. Thin wrappers around the OPFS API so callers
 * never touch `getFileHandle` directly — makes the call sites easier
 * to grep for P5 auditing and lets us swap the backend (e.g. to
 * Private File System v2) without editing every consumer.
 */
export async function opfsWrite(
  path: string,
  data: Blob | ArrayBuffer | Uint8Array | string,
): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const { dir, name } = splitPath(path);
  const directory = await ensureDirectory(root, dir);
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  // `FileSystemWriteChunkType` accepts BufferSource | Blob | string;
  // the cast keeps our API narrow without reflecting the union
  // through TS 5.7's stricter ArrayBuffer-vs-SharedArrayBuffer
  // checks. All runtime values we pass are ArrayBuffer-backed.
  await writable.write(data as FileSystemWriteChunkType);
  await writable.close();
}

export async function opfsRead(path: string): Promise<File | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const { dir, name } = splitPath(path);
    const directory = await ensureDirectory(root, dir);
    const handle = await directory.getFileHandle(name);
    return await handle.getFile();
  } catch {
    return null;
  }
}

function splitPath(path: string): { dir: string; name: string } {
  const clean = path.replace(/^\/+/, "");
  const parts = clean.split("/");
  const name = parts.pop();
  if (!name) throw new Error(`opfs: invalid path "${path}"`);
  return { dir: parts.join("/") || ".", name };
}
