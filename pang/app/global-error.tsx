"use client";

/**
 * Catastrophic-failure error boundary.
 *
 * Activates only when the root layout itself throws. Next requires
 * this file to ship its own <html> and <body> because the layout chain
 * is not available. Keep it dependency-free — no fonts, no providers,
 * no Tailwind utility classes that depend on globals.css being loaded
 * (it may not be).
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 24,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: "#f7f6f4",
          color: "#1a1a1a",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
            PANG could not start.
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
            A fatal error prevented the app from rendering.
            {error.digest ? ` Reference ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid #1a1a1a",
              background: "#1a1a1a",
              color: "#f7f6f4",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
