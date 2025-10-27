import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { captureException } from "../lib/sentry";
import { enqueuePodcastProcessing } from "../lib/taskQueue";
import { config } from "../config/environment";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Listen to ALL Storage events in the default bucket
// Firebase will automatically use the correct bucket based on the project
// Region wird automatisch angepasst: TEST=europe-west1, PROD=europe-west3
export const onPodcastUploaded = onObjectFinalized(
  {
    region: config.region, // ✅ Automatisch: TEST=europe-west1, PROD=europe-west3
    // No bucket specified = listen to default project bucket
  },
  async (event) => {
    const filePath = event.data.name;
    const fileSize = parseInt(String(event.data.size || "0"));
    const contentType = event.data.contentType;

    logger.info("=".repeat(80));
    logger.info(`[onPodcastUploaded] TRIGGER FIRED - File uploaded: ${filePath}`);
    logger.info(`[onPodcastUploaded] File size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    logger.info(`[onPodcastUploaded] Content type: ${contentType}`);
    logger.info("=".repeat(80));

    // Check if it's a podcast file
    if (!filePath.startsWith("podcasts/")) {
      logger.info(`[onPodcastUploaded] Not a podcast file (path: ${filePath}), ignoring`);
      return;
    }

    try {
      // Extract userId from path: podcasts/{userId}/{timestamp}_{filename}
      const pathParts = filePath.split("/");
      logger.info(`[onPodcastUploaded] Path parts: ${JSON.stringify(pathParts)}`);

      if (pathParts.length < 3) {
        logger.error(`[onPodcastUploaded] Invalid path format: ${filePath}`);
        return;
      }

      const userId = pathParts[1];
      const fileName = pathParts[2].replace(/^\d+_/, ""); // Remove timestamp prefix

      logger.info(`[onPodcastUploaded] Extracted userId: ${userId}, fileName: ${fileName}`);
      logger.info(`[onPodcastUploaded] Creating podcast document in Firestore...`);

      // Create podcast document in Firestore
      const podcastData = {
        userId,
        fileName,
        fileSize,
        contentType: contentType || "audio/mpeg",
        storagePath: filePath,
        status: "queued",
        uploadedAt: FieldValue.serverTimestamp(),
        queuedAt: FieldValue.serverTimestamp(),
      };

      logger.info(`[onPodcastUploaded] Podcast data to write: ${JSON.stringify(podcastData)}`);

      const podcastRef = await db.collection("podcasts").add(podcastData);

      const podcastId = podcastRef.id;
      logger.info(`[onPodcastUploaded] ✅ Created podcast document: ${podcastId}`);

      // Enqueue processing task (handles long-running Gemini API call)
      logger.info(`[onPodcastUploaded] Enqueueing processing task for: ${podcastId}`);

      try {
        await enqueuePodcastProcessing(podcastId, filePath);
        logger.info(`[onPodcastUploaded] ✅ Task enqueued successfully`);
      } catch (enqueueError: any) {
        logger.error(`[onPodcastUploaded] ❌ Failed to enqueue task:`, enqueueError);

        // Update podcast status to error since we couldn't enqueue
        await db.collection("podcasts").doc(podcastId).update({
          status: "error",
          errorMessage: `Failed to enqueue processing task: ${enqueueError.message}`,
          errorAt: FieldValue.serverTimestamp(),
        });

        throw enqueueError;
      }

      logger.info(`[onPodcastUploaded] ✅ Trigger completed successfully for: ${podcastId}`);
      logger.info("=".repeat(80));
    } catch (error: any) {
      logger.error("=".repeat(80));
      logger.error(`[onPodcastUploaded] ❌ ERROR in onPodcastUploaded:`, {
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
        filePath,
        fileSize,
        contentType,
      });
      logger.error("=".repeat(80));

      // Report to Sentry
      captureException(error, {
        functionName: "onPodcastUploaded",
        extra: {
          filePath,
          fileSize,
          contentType,
        },
      });
    }
  }
);
