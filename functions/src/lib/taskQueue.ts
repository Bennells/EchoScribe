import { getFunctions } from "firebase-admin/functions";
import * as logger from "firebase-functions/logger";
import { config, getRegionInfo } from "../config/environment";

/**
 * Enqueue a task to process a podcast
 *
 * Verwendet automatisch die korrekte Region:
 * - TEST: europe-west1 (Multi-Region EU)
 * - PROD: europe-west3 (Deutschland)
 *
 * @param podcastId - The ID of the podcast document in Firestore
 * @param storagePath - The full storage path to the audio file
 */
export async function enqueuePodcastProcessing(
  podcastId: string,
  storagePath: string
): Promise<void> {
  try {
    logger.info(`[TaskQueue] Enqueueing processing task for podcast: ${podcastId}`);

    // ✅ Automatisch aus Config - passt sich an TEST/PROD an!
    const { queuePath, uri } = config.functions.processPodcastTask;
    const info = getRegionInfo();

    logger.info(`[TaskQueue] Environment: ${info.environment}`);
    logger.info(`[TaskQueue] Hosting: ${info.hosting}`);
    logger.info(`[TaskQueue] Queue path: ${queuePath}`);
    logger.info(`[TaskQueue] Target URI: ${uri}`);

    const queue = getFunctions().taskQueue(queuePath);

    await queue.enqueue(
      {
        podcastId,
        storagePath,
      },
      {
        // Schedule options
        scheduleDelaySeconds: 0, // Process immediately
        dispatchDeadlineSeconds: config.cloudTasks.dispatchDeadlineSeconds,
        uri: uri, // Required: tells Cloud Tasks where to send the request
      }
    );

    logger.info(`[TaskQueue] ✅ Task enqueued successfully:`, {
      podcastId,
      environment: config.projectId,
      region: config.region,
    });
  } catch (error: any) {
    logger.error(`[TaskQueue] ❌ Failed to enqueue task for ${podcastId}:`, {
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
      errorStack: error.stack,
    });

    // Rethrow to let caller handle
    throw error;
  }
}
