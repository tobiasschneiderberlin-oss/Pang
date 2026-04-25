/**
 * PANG — demo seeder (REMOVABLE; see ./REMOVAL.md).
 *
 * Two operations exposed:
 *
 *   - `seedDemoCollection()` — idempotently merges the 15 demo works
 *     into the works store and persists them through the existing
 *     OPFS pipeline. Returns the count of newly-added entries.
 *   - `clearDemoCollection()` — removes only entries with `demo-`
 *     ids from the store and OPFS, leaving any real
 *     (collector-scanned) works intact.
 *
 * Both functions are no-ops on the server (typeof navigator check).
 * They are called from `AppBoot` when the URL carries the
 * `?seed=demo` or `?seed=clear` query parameter.
 */

import { useWorks } from "@/stores/works";
import { DEMO_WORKS, isDemoEntry } from "./works";

export function seedDemoCollection(): number {
  if (typeof navigator === "undefined") return 0;
  const store = useWorks.getState();
  const existingIds = new Set(store.entries.map((e) => e.id));
  let added = 0;
  for (const work of DEMO_WORKS) {
    if (existingIds.has(work.id)) continue;
    store.addEntry(work);
    added += 1;
  }
  return added;
}

export function clearDemoCollection(): number {
  if (typeof navigator === "undefined") return 0;
  const store = useWorks.getState();
  const demoIds = store.entries.filter((e) => isDemoEntry(e.id)).map((e) => e.id);
  for (const id of demoIds) {
    store.removeEntry(id);
  }
  return demoIds.length;
}
