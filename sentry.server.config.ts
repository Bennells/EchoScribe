import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Server-Side Configuration
 *
 * This configuration applies to the Next.js server environment (API routes, SSR, etc.).
 * Only enabled in production to avoid noise from development errors.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize Sentry in production
if (SENTRY_DSN && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Set environment
    environment: process.env.NODE_ENV,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Ignore common non-actionable errors
    ignoreErrors: [
      // Network errors
      "NetworkError",
      "Network request failed",
      // Firebase errors that are expected
      "auth/network-request-failed",
    ],
  });
}
