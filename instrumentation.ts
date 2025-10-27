/**
 * Instrumentation for Node.js
 *
 * This file is automatically loaded by Next.js when the server starts.
 * It's used to initialize Sentry and other monitoring tools.
 *
 * Only loads Sentry in production to avoid warnings in DEV/TEST.
 */

export async function register() {
  // Only load Sentry configs in production
  if (process.env.NODE_ENV === "production") {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
    }
  }
}
