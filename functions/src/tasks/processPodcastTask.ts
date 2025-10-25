import { onTaskDispatched } from "firebase-functions/v2/tasks";
import * as logger from "firebase-functions/logger";
import { processPodcast } from "../triggers/processPodcast";
import { captureException } from "../lib/sentry";

/**
 * Cloud Task Handler for processing podcasts
 * This runs asynchronously and can take as long as needed
 *
 * Benefits:
 * - No timeout issues (can run for hours if needed)
 * - Automatic retries on failure
 * - Better error handling
 * - Scalable (queue manages concurrent processing)
 */
export const processPodcastTask = onTaskDispatched(
  {
    // Retry configuration
    retryConfig: {
      maxAttempts: 5, // Try up to 5 times
      minBackoffSeconds: 60, // Wait at least 1 minute between retries
      maxBackoffSeconds: 3600, // Wait at most 1 hour
      maxDoublings: 3, // Exponential backoff: 1min, 2min, 4min, then cap at 1hr
    },
    // Rate limits to avoid overwhelming Gemini API
    rateLimits: {
      maxConcurrentDispatches: 3, // Max 3 podcasts processing at once
    },
    // Memory and timeout
    memory: "1GiB", // More memory for large audio files
    timeoutSeconds: 3600, // 1 hour max (plenty of time for Gemini)
    region: "europe-west1",
  },
  async (request) => {
    const { podcastId, storagePath } = request.data;
    const attemptNumber = request.retryCount + 1;

    logger.info(`[Task] Processing podcast task`, {
      podcastId,
      storagePath,
      attemptNumber,
      maxAttempts: 5,
    });

    try {
      // Call the actual processing function
      await processPodcast(podcastId, storagePath);

      logger.info(`[Task] Successfully processed podcast ${podcastId}`);
    } catch (error: any) {
      logger.error(`[Task] Error processing podcast ${podcastId}`, {
        error: error.message,
        stack: error.stack,
        attemptNumber,
      });

      // Report to Sentry with full context
      captureException(error, {
        functionName: "processPodcastTask",
        podcastId,
        attemptNumber,
        extra: {
          storagePath,
          maxAttempts: 5,
          isLastAttempt: attemptNumber >= 5,
        },
      });

      // Rethrow error to trigger automatic retry
      throw error;
    }
  }
);
