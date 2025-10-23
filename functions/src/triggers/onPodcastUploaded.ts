import { onObjectFinalized } from "firebase-functions/v2/storage";
import { getFunctions } from "firebase-admin/functions";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { processPodcast } from "./processPodcast";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const onPodcastUploaded = onObjectFinalized(
  {
    region: "europe-west1",
  },
  async (event) => {
    const filePath = event.data.name;
    const fileSize = parseInt(String(event.data.size || "0"));
    const contentType = event.data.contentType;

    logger.info(`File uploaded: ${filePath}, size: ${fileSize}, type: ${contentType}`);

    // Check if it's a podcast file
    if (!filePath.startsWith("podcasts/")) {
      logger.info("Not a podcast file, ignoring");
      return;
    }

    try {
      // Extract userId from path: podcasts/{userId}/{timestamp}_{filename}
      const pathParts = filePath.split("/");
      if (pathParts.length < 3) {
        logger.error(`Invalid path format: ${filePath}`);
        return;
      }

      const userId = pathParts[1];
      const fileName = pathParts[2].replace(/^\d+_/, ""); // Remove timestamp prefix

      logger.info(`Creating podcast document for user: ${userId}`);

      // Create podcast document in Firestore
      const podcastRef = await db.collection("podcasts").add({
        userId,
        fileName,
        fileSize,
        contentType: contentType || "audio/mpeg",
        storagePath: filePath,
        status: "queued",
        uploadedAt: FieldValue.serverTimestamp(),
        queuedAt: FieldValue.serverTimestamp(),
      });

      const podcastId = podcastRef.id;
      logger.info(`Created podcast document: ${podcastId}`);

      // Check if running in emulator
      const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

      if (isEmulator) {
        // In emulator: process directly (Cloud Tasks don't work in emulator)
        logger.info(`[EMULATOR] Processing podcast directly: ${podcastId}`);
        // Process asynchronously without blocking the upload response
        processPodcast(podcastId, filePath).catch((error) => {
          logger.error(`[EMULATOR] Failed to process podcast ${podcastId}:`, error);
        });
        logger.info(`[EMULATOR] Processing started in background for: ${podcastId}`);
      } else {
        // In production: enqueue Cloud Task for better scalability
        await enqueueProcessingTask(podcastId, filePath);
      }
    } catch (error: any) {
      logger.error("Error in onPodcastUploaded:", error);
    }
  }
);

/**
 * Enqueue a Cloud Task to process the podcast asynchronously
 * This returns immediately, allowing the function to complete quickly
 */
async function enqueueProcessingTask(podcastId: string, storagePath: string) {
  try {
    logger.info(`Enqueueing processing task for podcast: ${podcastId}`);

    const queue = getFunctions().taskQueue("processPodcastTask", "europe-west1");

    await queue.enqueue(
      {
        podcastId,
        storagePath,
      },
      {
        // Schedule the task to run immediately
        scheduleDelaySeconds: 0,
        // Dispatch deadline (how long the task can wait in queue before being dispatched)
        // Max allowed: 1800 seconds (30 minutes)
        dispatchDeadlineSeconds: 1800,
      }
    );

    logger.info(`Successfully enqueued task for podcast: ${podcastId}`);
  } catch (error: any) {
    logger.error(`Error enqueueing task for ${podcastId}:`, {
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
    });

    // Update podcast status to error if we can't even enqueue
    try {
      await db.collection("podcasts").doc(podcastId).update({
        status: "error",
        errorMessage: "Failed to enqueue processing task: " + error.message,
        errorAt: FieldValue.serverTimestamp(),
      });
    } catch (updateError: any) {
      logger.error(`Failed to update error status for ${podcastId}:`, updateError);
    }

    // Rethrow to indicate failure
    throw error;
  }
}
