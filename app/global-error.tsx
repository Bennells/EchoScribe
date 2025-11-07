"use client";

import { useEffect } from "react";

/**
 * Global Error Handler
 *
 * This catches errors at the root level (above the root layout).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("Global error (root level):", error);
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
