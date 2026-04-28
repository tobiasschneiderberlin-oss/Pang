"use client";

/**
 * Root error boundary.
 *
 * Catches errors thrown anywhere under app/ that aren't caught by a
 * nested error boundary. Renders a single recoverable error state
 * with a "try again" button that calls Next's `reset()` to re-render
 * the boundary's segment.
 *
 * Catastrophic errors that escape the layout (e.g. a render error in
 * RootLayout itself) fall through to `global-error.tsx`.
 */

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to whatever observability sink we wire next (Sentry, etc).
    // For now: dev console only. The `digest` field is Next's correlation
    // id between client + server logs.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[RootError]", error, "digest:", error.digest);
    }
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <ErrorState
          type="error"
          title="Something went wrong."
          description={
            error.digest
              ? `An unexpected error occurred. Reference ${error.digest}.`
              : "An unexpected error occurred. The team has been notified."
          }
          action={{ label: "Try again", onClick: reset }}
        />
      </div>
    </main>
  );
}
