import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { config } from "../config/environment";
import { safeRefundQuota } from "../utils/quotaHelpers";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cleanup Job for Stuck Podcasts
 *
 * Runs every hour to find and clean up podcasts that have been stuck in "processing" status
 * for more than 90 minutes (HTTP function timeout is 60 minutes + 30 minute grace period).
 *
 * This catches edge cases:
 * - HTTP function crashes after updating status to "processing"
 * - HTTP function times out (>60 minutes)
 * - Any other unexpected failures
 *
 * Actions taken:
 * - Mark podcast as "error" with timeout message
 * - Refund quota to user (fair - they shouldn't lose quota on system failures)
 * - Log details for monitoring
 */
export const cleanupStuckPodcasts = onSchedule(
  {
    schedule: "every 1 hours", // Run every hour
    timeZone: "Europe/Berlin", // Adjust to your timezone
    region: config.region,
    memory: "256MiB", // Low memory - just database queries
  },
  async (event) => {
    logger.info("=".repeat(80));
    logger.info(`[Cleanup] Starting stuck podcast cleanup job`);
    logger.info("=".repeat(80));

    try {
      // Find podcasts stuck in "processing" for more than 90 minutes
      const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000);

      logger.info(`[Cleanup] Searching for podcasts stuck since before: ${ninetyMinutesAgo.toISOString()}`);

      const stuckPodcasts = await db
        .collection("podcasts")
        .where("status", "==", "processing")
        .where("processingStartedAt", "<", ninetyMinutesAgo)
        .get();

      if (stuckPodcasts.empty) {
        logger.info(`[Cleanup] ✅ No stuck podcasts found`);
        logger.info("=".repeat(80));
        return;
      }

      logger.warn(`[Cleanup] ⚠️ Found ${stuckPodcasts.size} stuck podcast(s)`);

      let cleaned = 0;
      let failed = 0;

      for (const doc of stuckPodcasts.docs) {
        const podcastId = doc.id;
        const podcastData = doc.data();

        try {
          logger.info(`[Cleanup] Processing stuck podcast: ${podcastId}`, {
            userId: podcastData.userId,
            duration: podcastData.duration,
            processingStartedAt: podcastData.processingStartedAt?.toDate().toISOString(),
          });

          // Calculate how long it's been stuck
          const startedAt = podcastData.processingStartedAt?.toDate();
          const stuckDuration = startedAt
            ? Math.round((Date.now() - startedAt.getTime()) / 1000 / 60)
            : "unknown";

          // Update podcast status to error
          await db.collection("podcasts").doc(podcastId).update({
            status: "error",
            errorMessage: `Processing timeout - stuck for ${stuckDuration} minutes. This is a system error, your quota has been refunded.`,
            errorDetails: {
              code: "PROCESSING_TIMEOUT",
              timestamp: new Date().toISOString(),
              stuckDuration: `${stuckDuration} minutes`,
              cleanupJob: true,
            },
            errorAt: FieldValue.serverTimestamp(),
          });

          logger.info(`[Cleanup] ✅ Updated podcast ${podcastId} status to error`);

          // Refund quota to user
          if (podcastData.userId && podcastData.duration) {
            await safeRefundQuota(
              podcastData.userId,
              podcastData.duration,
              `Cleanup: Processing timeout (stuck for ${stuckDuration} minutes)`
            );
            logger.info(`[Cleanup] ✅ Refunded ${podcastData.duration} minutes to user ${podcastData.userId}`);
          } else {
            logger.warn(`[Cleanup] ⚠️ Could not refund quota - missing userId or duration`);
          }

          cleaned++;

          // Log for monitoring/alerting
          logger.error("Stuck podcast cleaned up", {
            podcastId,
            userId: podcastData.userId,
            duration: podcastData.duration,
            stuckDuration: `${stuckDuration} minutes`,
            fileName: podcastData.fileName,
          });
        } catch (error: any) {
          failed++;
          logger.error(`[Cleanup] ❌ Failed to clean up podcast ${podcastId}:`, {
            error: error.message,
            stack: error.stack,
          });
        }
      }

      logger.info("=".repeat(80));
      logger.info(`[Cleanup] ✅ Cleanup job completed`);
      logger.info(`  - Stuck podcasts found: ${stuckPodcasts.size}`);
      logger.info(`  - Successfully cleaned: ${cleaned}`);
      logger.info(`  - Failed to clean: ${failed}`);
      logger.info("=".repeat(80));

      // If we found stuck podcasts, this indicates a problem - log as error for monitoring
      if (stuckPodcasts.size > 0) {
        logger.error("Stuck podcasts detected - investigate HTTP function reliability", {
          total: stuckPodcasts.size,
          cleaned,
          failed,
        });
      }
    } catch (error: any) {
      logger.error("=".repeat(80));
      logger.error(`[Cleanup] ❌ Cleanup job failed:`, {
        error: error.message,
        stack: error.stack,
      });
      logger.error("=".repeat(80));
      throw error;
    }
  }
);
