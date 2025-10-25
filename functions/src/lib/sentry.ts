import * as Sentry from "@sentry/node";
import * as functions from "firebase-functions";

/**
 * Initialize Sentry for Cloud Functions
 *
 * Only enabled in production to avoid noise from development/test environments.
 */

const SENTRY_DSN = process.env.SENTRY_DSN;
const environment = process.env.FIREBASE_CONFIG
  ? JSON.parse(process.env.FIREBASE_CONFIG).projectId
  : "development";

// Only initialize Sentry if DSN is provided (production)
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment,
    tracesSampleRate: 0.1, // 10% performance monitoring

    // Integrate with Firebase Functions
    integrations: [
      Sentry.anrIntegration({ captureStackTrace: true }),
      Sentry.httpIntegration(),
    ],
  });

  functions.logger.info("Sentry initialized for Cloud Functions", {
    environment,
  });
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error,
  context?: {
    functionName?: string;
    userId?: string;
    podcastId?: string;
    attemptNumber?: number;
    extra?: Record<string, any>;
  }
) {
  if (!SENTRY_DSN) {
    // In development, just log to console
    functions.logger.error("Error (Sentry not configured):", {
      error: error.message,
      stack: error.stack,
      ...context,
    });
    return;
  }

  Sentry.captureException(error, {
    tags: {
      functionName: context?.functionName,
    },
    user: context?.userId ? { id: context.userId } : undefined,
    contexts: {
      function: {
        name: context?.functionName,
        attemptNumber: context?.attemptNumber,
      },
      podcast: context?.podcastId
        ? {
            id: context.podcastId,
          }
        : undefined,
    },
    extra: context?.extra,
  });
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, any>
) {
  if (!SENTRY_DSN) {
    functions.logger.info(message, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for Sentry
 */
export function setUser(userId: string, email?: string) {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user context
 */
export function clearUser() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

/**
 * Wrapper for Cloud Functions to automatically capture errors
 */
export function wrapFunction<T extends (...args: any[]) => any>(
  functionName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error: any) {
      captureException(error, {
        functionName,
        extra: {
          arguments: args,
        },
      });
      throw error;
    }
  }) as T;
}

export { Sentry };
