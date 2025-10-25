import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Client-Side Configuration
 *
 * This configuration applies to the browser environment.
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

    replaysOnErrorSampleRate: 1.0, // Capture 100% of errors for session replay
    replaysSessionSampleRate: 0.1, // Capture 10% of all sessions for replay

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true, // Mask all text for GDPR compliance
        blockAllMedia: true, // Block all media for GDPR compliance
      }),
    ],

    // Filter out errors we don't want to track
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Filter out common non-actionable errors
      if (error && typeof error === "string") {
        // Ignore common browser extension errors
        if (
          error.includes("Non-Error promise rejection") ||
          error.includes("ResizeObserver loop")
        ) {
          return null;
        }
      }

      return event;
    },
  });
}
