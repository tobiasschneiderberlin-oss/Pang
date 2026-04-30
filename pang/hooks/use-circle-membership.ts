"use client";

/**
 * Circle membership — pre-Auth source of truth.
 *
 * Tracks which artist circles the local user has joined. Persisted in
 * localStorage under one key, modelled as a Set of artist ids serialised
 * to a JSON array so multiple browser tabs converge on the same view.
 *
 * Post-Auth this hook is replaced by a Supabase query against the
 * `collector_artist_circle_membership` table (or whatever the final
 * shape lands as). The hook contract — `{ joined, isMember, join,
 * leave }` — stays identical so call sites don't change.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pang-circle-membership";
const STORAGE_EVENT = "pang-circle-membership-changed";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  // Same-tab broadcast — `storage` events only fire in OTHER tabs, not
  // the writing one, so we dispatch a custom event for the local tab.
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
}

export function useCircleMembership() {
  // SSR-safe: start with an empty Set, hydrate from localStorage on mount.
  const [joined, setJoined] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setJoined(readSet());
    const refresh = () => setJoined(readSet());
    window.addEventListener("storage", refresh);
    window.addEventListener(STORAGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(STORAGE_EVENT, refresh);
    };
  }, []);

  const isMember = useCallback((artistId: string) => joined.has(artistId), [joined]);

  const join = useCallback((artistId: string) => {
    const next = new Set(readSet());
    next.add(artistId);
    writeSet(next);
    setJoined(next);
  }, []);

  const leave = useCallback((artistId: string) => {
    const next = new Set(readSet());
    next.delete(artistId);
    writeSet(next);
    setJoined(next);
  }, []);

  return { joined, isMember, join, leave };
}
