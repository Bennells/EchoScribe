import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

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
    logger.info(`File uploaded: ${filePath}`);

    // Check if it's a podcast file
    if (!filePath.startsWith("podcasts/")) {
      logger.info("Not a podcast file, ignoring");
      return;
    }

    try {
      // Find podcast document by storagePath
      const podcastsSnapshot = await db
        .collection("podcasts")
        .where("storagePath", "==", filePath)
        .limit(1)
        .get();

      if (podcastsSnapshot.empty) {
        logger.warn(`No podcast document found for path: ${filePath}`);
        return;
      }

      const podcastDoc = podcastsSnapshot.docs[0];
      const podcastId = podcastDoc.id;

      logger.info(`Found podcast document: ${podcastId}`);

      // Update status to "queued" for processing
      await db.collection("podcasts").doc(podcastId).update({
        status: "queued",
        queuedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`Podcast ${podcastId} queued for processing`);

      // Trigger processing (we'll call processPodcast directly for simplicity)
      // In production, you'd use Cloud Tasks for better queue management
      await processPodcastNow(podcastId, filePath);
    } catch (error: any) {
      logger.error("Error in onPodcastUploaded:", error);
    }
  }
);

// Process podcast immediately (simplified version without queue)
async function processPodcastNow(podcastId: string, storagePath: string) {
  try {
    logger.info(`Starting processing for podcast: ${podcastId}`);

    // Import processing function
    const { processPodcast } = await import("./processPodcast");
    await processPodcast(podcastId, storagePath);
  } catch (error: any) {
    logger.error(`Error processing podcast ${podcastId}:`, error);

    // Update podcast status to error
    await db.collection("podcasts").doc(podcastId).update({
      status: "error",
      errorMessage: error.message || "Unknown error",
      errorAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
