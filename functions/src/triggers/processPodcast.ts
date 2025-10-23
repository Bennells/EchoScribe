import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { processAudioWithGemini } from "../services/gemini";
import { generateSlug } from "../utils/prompts";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export async function processPodcast(podcastId: string, storagePath: string) {
  logger.info(`Processing podcast ${podcastId} from ${storagePath}`);

  try {
    // Update status to processing
    logger.info(`Updating podcast ${podcastId} status to processing`);
    await db.collection("podcasts").doc(podcastId).update({
      status: "processing",
      processingStartedAt: FieldValue.serverTimestamp(),
    });
    logger.info(`Status updated successfully`);

    // Get podcast data
    const podcastDoc = await db.collection("podcasts").doc(podcastId).get();
    if (!podcastDoc.exists) {
      throw new Error("Podcast document not found");
    }

    const podcastData = podcastDoc.data();
    if (!podcastData) {
      throw new Error("Podcast data is empty");
    }

    logger.info(`Podcast data retrieved:`, {
      userId: podcastData.userId,
      fileName: podcastData.fileName,
      fileSize: podcastData.fileSize,
    });

    // Download audio file from Storage
    logger.info(`Downloading audio file from: ${storagePath}`);
    const file = bucket.file(storagePath);
    const [audioBuffer] = await file.download();
    logger.info(`Downloaded ${audioBuffer.length} bytes (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Process with Gemini
    logger.info("Sending to Gemini for processing...");
    const article = await processAudioWithGemini(audioBuffer);
    logger.info("Article generated successfully");

    // Ensure slug is generated
    if (!article.slug) {
      article.slug = generateSlug(article.title);
    }

    // Save article to Firestore
    const articleRef = await db.collection("articles").add({
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
    });

    logger.info(`Article created: ${articleRef.id}`);

    // Update podcast status to completed
    await db.collection("podcasts").doc(podcastId).update({
      status: "completed",
      articleId: articleRef.id,
      processingCompletedAt: FieldValue.serverTimestamp(),
    });

    // Increment user quota
    try {
      await db.collection("users").doc(podcastData.userId).update({
        "quota.used": FieldValue.increment(1),
      });
      logger.info(`Incremented quota for user ${podcastData.userId}`);
    } catch (quotaError: any) {
      logger.error(`Failed to increment quota:`, quotaError);
      // Don't fail the whole process if quota update fails
    }

    logger.info(`Podcast ${podcastId} processing completed`);
  } catch (error: any) {
    logger.error(`Error processing podcast ${podcastId}:`, {
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: error.code,
      errorDetails: error.details || error.response?.data,
    });

    // Update status to error with detailed information
    try {
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
      logger.info(`Updated podcast ${podcastId} status to error`);
    } catch (updateError: any) {
      logger.error(`Failed to update podcast status to error:`, {
        updateErrorMessage: updateError.message,
        updateErrorCode: updateError.code,
      });
    }

    throw error;
  }
}
