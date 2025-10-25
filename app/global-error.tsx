"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Global Error Handler
 *
 * This catches errors at the root level (above the root layout).
 * Required for Sentry to properly capture some edge cases.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("Global error (root level):", error);

    // Report error to Sentry in production
    if (process.env.NODE_ENV === "production") {
      Sentry.captureException(error, {
        level: "fatal",
        tags: {
          location: "global-error",
        },
      });
    }
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h1>Etwas ist schiefgelaufen</h1>
          <p>Bitte laden Sie die Seite neu.</p>
          <button onClick={() => window.location.reload()}>
            Seite neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
