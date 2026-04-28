"use client";

/**
 * Auth-protected route error boundary.
 *
 * Catches errors thrown anywhere under app/(app)/* — the route group
 * that will eventually require an authenticated session. Today the
 * (app) layout doesn't enforce auth; when it does (post-Supabase
 * wiring), this boundary picks up auth-failure errors as well.
 *
 * Falls through to `app/error.tsx` if not handled here.
 */

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[AppError]", error, "digest:", error.digest);
    }
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <ErrorState
          type="error"
          title="This page hit a snag."
          description={
            error.digest
              ? `Something went wrong loading your view. Reference ${error.digest}.`
              : "Something went wrong loading your view. Try again, or come back to the home tab."
          }
          action={{ label: "Try again", onClick: reset }}
        />
      </div>
    </main>
  );
}
