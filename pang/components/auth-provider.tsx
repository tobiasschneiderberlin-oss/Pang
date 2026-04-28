"use client";

/**
 * PANG — auth context placeholder.
 *
 * Provides the shape of the authenticated user across the app:
 * `useUser()` returns the current `User | null`, `useAuth()` returns
 * the full `{ user, isLoading, signOut }` triple. Pages that gate on
 * authentication consume one of these hooks rather than each running
 * its own auth check.
 *
 * Today the implementation is a localStorage shim — there is no
 * backend yet (per ADR-001 Q1 the gallery portal is a future app, and
 * the collector PWA's Supabase wiring lands in Week 2 of ADR-001's
 * action plan). The shape, the hooks, and the provider boundary are
 * what matter — the implementation swaps when Supabase Auth lands and
 * no consumer changes.
 *
 * When Supabase comes:
 *   - This module subscribes to `supabase.auth.onAuthStateChange`.
 *   - `User` extends to mirror the Supabase user shape + a Drizzle-
 *     derived `Collector` join (per ADR-001 Q2 the collector owns rows).
 *   - `signOut` calls `supabase.auth.signOut()`.
 *   - The localStorage shim is deleted.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const DEMO_USER_STORAGE_KEY = "pang_demo_user";

export type User = {
  id: string;
  email: string;
  name: string;
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  signInDemo: (user: User) => void; // dev/demo only — removed when Supabase lands
  signOut: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored) as User);
    } catch {
      // Corrupt JSON or quota error — fall through to unauthenticated.
    }
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      signInDemo: (next) => {
        setUser(next);
        try {
          window.localStorage.setItem(
            DEMO_USER_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch {
          // localStorage may be unavailable (private mode); accept in-memory only.
        }
      },
      signOut: () => {
        setUser(null);
        try {
          window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        } catch {
          // no-op
        }
      },
    }),
    [user, isLoading],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/** Read the current user. Returns `null` when unauthenticated. */
export function useUser(): User | null {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useUser must be used within an <AuthProvider>");
  }
  return ctx.user;
}

/** Read the full auth state, including loading + signOut handle. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
