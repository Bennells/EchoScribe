import { onTaskDispatched } from "firebase-functions/v2/tasks";
import * as logger from "firebase-functions/logger";
import { processPodcast } from "../triggers/processPodcast";
import { config } from "../config/environment";

/**
 * Cloud Task Handler for processing podcasts
 * This runs asynchronously and can take as long as needed
 *
 * Region wird automatisch angepasst:
 * - TEST: europe-west1 (Multi-Region EU)
 * - PROD: europe-west3 (Deutschland)
 *
 * Benefits:
 * - No timeout issues (can run for hours if needed)
 * - Automatic retries on failure
 * - Better error handling
 * - Scalable (queue manages concurrent processing)
 */
export const processPodcastTask = onTaskDispatched(
  {
    // No secrets needed - uses Application Default Credentials (ADC) via WIF
    // Retry configuration
    retryConfig: {
      maxAttempts: 5, // Try up to 5 times
      minBackoffSeconds: 60, // Wait at least 1 minute between retries
      maxBackoffSeconds: 3600, // Wait at most 1 hour
      maxDoublings: 3, // Exponential backoff: 1min, 2min, 4min, then cap at 1hr
    },
    // Rate limits to avoid overwhelming Vertex AI API
    rateLimits: {
      maxConcurrentDispatches: 3, // Max 3 podcasts processing at once
    },
    // Memory and timeout (reduced from 8GiB - no base64 encoding needed!)
    memory: "4GiB", // Reduced from 8GiB - using Cloud Storage URIs instead of base64
    cpu: 2, // Required for 4GiB memory
    timeoutSeconds: 3600, // 1 hour max (plenty of time for Vertex AI)
    region: config.region, // ✅ Automatisch: TEST=europe-west1, PROD=europe-west3
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
        storagePath,
        maxAttempts: 5,
        isLastAttempt: attemptNumber >= 5,
      });

      // Rethrow error to trigger automatic retry
      throw error;
    }
  }
);
