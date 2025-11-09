import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { processAudioWithVertexAI } from "../services/vertexai";
import { generateSlug } from "../utils/prompts";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export async function processPodcast(podcastId: string, storagePath: string) {
  logger.info("=".repeat(80));
  logger.info(`[processPodcast] START - Processing podcast ${podcastId}`);
  logger.info(`[processPodcast] Storage path: ${storagePath}`);
  logger.info("=".repeat(80));

  let podcastData: any = null; // Make available in catch block for quota refund

  try {
    // Update status to processing
    logger.info(`[processPodcast] Step 1: Updating podcast ${podcastId} status to processing`);
    await db.collection("podcasts").doc(podcastId).update({
      status: "processing",
      processingStartedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[processPodcast] ✅ Status updated to 'processing'`);

    // Get podcast data
    logger.info(`[processPodcast] Step 2: Fetching podcast document from Firestore`);
    const podcastDoc = await db.collection("podcasts").doc(podcastId).get();
    if (!podcastDoc.exists) {
      throw new Error("Podcast document not found");
    }

    podcastData = podcastDoc.data();
    if (!podcastData) {
      throw new Error("Podcast data is empty");
    }

    logger.info(`[processPodcast] ✅ Podcast data retrieved:`, {
      userId: podcastData.userId,
      fileName: podcastData.fileName,
      fileSize: podcastData.fileSize,
      contentType: podcastData.contentType,
      duration: podcastData.duration,
    });

    // Verify audio file exists in Storage
    logger.info(`[processPodcast] Step 3: Verifying audio file in Storage`);
    logger.info(`[processPodcast] Storage bucket: ${bucket.name}`);
    logger.info(`[processPodcast] File path: ${storagePath}`);

    const file = bucket.file(storagePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File does not exist in storage: ${storagePath}`);
    }

    // Get file metadata for MIME type
    const [metadata] = await file.getMetadata();
    const mimeType = metadata.contentType || podcastData.contentType || "audio/mpeg";

    logger.info(`[processPodcast] ✅ File verified in storage`, {
      storagePath,
      mimeType,
      size: metadata.size,
      sizeMB: (parseInt(String(metadata.size || 0)) / 1024 / 1024).toFixed(2),
    });

    // Process with Vertex AI (using Cloud Storage URI - no download needed!)
    logger.info(`[processPodcast] Step 4: Sending to Vertex AI for processing...`);
    logger.info(`[processPodcast] Using Cloud Storage URI (no download required)`);
    const article = await processAudioWithVertexAI(storagePath, mimeType);
    logger.info(`[processPodcast] ✅ Article generated successfully`);
    logger.info(`[processPodcast] Article title: ${article.title}`);

    // Ensure slug is generated
    if (!article.slug) {
      logger.info(`[processPodcast] Generating slug from title: ${article.title}`);
      article.slug = generateSlug(article.title);
    }
    logger.info(`[processPodcast] Article slug: ${article.slug}`);

    // Save article to Firestore
    logger.info(`[processPodcast] Step 5: Saving article to Firestore`);
    const articleData: any = {
      podcastId,
      userId: podcastData.userId,
      title: article.title,
      slug: article.slug,
      metaDescription: article.metaDescription,
      keywords: article.keywords || [],
      contentMarkdown: article.markdown,
      contentHTML: article.html,
      schemaOrgMarkup: article.schemaOrg || {},
      openGraphTags: article.openGraph || {},
      createdAt: FieldValue.serverTimestamp(),
    };

    // Add optional new fields if they exist
    if (article.socialMedia) {
      articleData.socialMedia = article.socialMedia;
      logger.info(`[processPodcast] ✅ Social Media content included (${Object.keys(article.socialMedia).length} platforms)`);
    }

    if (article.showNotes) {
      articleData.showNotes = article.showNotes;
      logger.info(`[processPodcast] ✅ Show Notes included (${article.showNotes.chapters.length} chapters, ${article.showNotes.quotes.length} quotes)`);
    }

    logger.info(`[processPodcast] Article data prepared (${JSON.stringify(articleData).length} chars)`);
    const articleRef = await db.collection("articles").add(articleData);

    logger.info(`[processPodcast] ✅ Article created: ${articleRef.id}`);

    // Update podcast status to completed
    logger.info(`[processPodcast] Step 6: Updating podcast status to completed`);
    await db.collection("podcasts").doc(podcastId).update({
      status: "completed",
      articleId: articleRef.id,
      processingCompletedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`[processPodcast] ✅ Podcast status updated to 'completed'`);

    // Note: Quota was already reserved in onPodcastUploaded.ts when the upload completed
    // No additional quota increment needed here to avoid double-counting

    logger.info("=".repeat(80));
    logger.info(`[processPodcast] ✅ COMPLETED - Podcast ${podcastId} processing finished successfully`);
    logger.info("=".repeat(80));
  } catch (error: any) {
    logger.error("=".repeat(80));
    logger.error(`[processPodcast] ❌ ERROR - Processing failed for podcast ${podcastId}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: error.code,
      errorDetails: error.details || error.response?.data,
      storagePath,
    });
    logger.error("=".repeat(80));

    // Update status to error with detailed information
    try {
      logger.info(`[processPodcast] Updating podcast status to 'error'`);
      await db.collection("podcasts").doc(podcastId).update({
        status: "error",
        errorMessage: error.message || "Unknown error",
        errorDetails: {
          code: error.code,
          timestamp: new Date().toISOString(),
          stack: error.stack?.substring(0, 500), // Limit stack trace size
        },
        errorAt: FieldValue.serverTimestamp(),
      });
      logger.info(`[processPodcast] ✅ Updated podcast ${podcastId} status to error`);
    } catch (updateError: any) {
      logger.error(`[processPodcast] ❌ Failed to update podcast status to error:`, {
        updateErrorMessage: updateError.message,
        updateErrorCode: updateError.code,
      });
    }

    // Refund quota since processing failed
    if (podcastData && podcastData.userId && podcastData.duration) {
      try {
        logger.info(`[processPodcast] Refunding quota for failed processing: ${podcastData.duration} minutes`);
        await db.collection("users").doc(podcastData.userId).update({
          "quota.used": FieldValue.increment(-podcastData.duration),
        });
        logger.info(`[processPodcast] ✅ Quota refunded: ${podcastData.duration} minutes`);
      } catch (refundError: any) {
        logger.error(`[processPodcast] ❌ Failed to refund quota:`, {
          refundErrorMessage: refundError.message,
          userId: podcastData.userId,
          duration: podcastData.duration,
        });
      }
    } else {
      logger.warn(`[processPodcast] ⚠️ Could not refund quota - missing podcastData, userId or duration`);
    }

    throw error;
  }
}
