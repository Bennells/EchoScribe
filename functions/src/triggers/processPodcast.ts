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
  logger.info("=".repeat(80));
  logger.info(`[processPodcast] START - Processing podcast ${podcastId}`);
  logger.info(`[processPodcast] Storage path: ${storagePath}`);
  logger.info("=".repeat(80));

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

    const podcastData = podcastDoc.data();
    if (!podcastData) {
      throw new Error("Podcast data is empty");
    }

    logger.info(`[processPodcast] ✅ Podcast data retrieved:`, {
      userId: podcastData.userId,
      fileName: podcastData.fileName,
      fileSize: podcastData.fileSize,
      contentType: podcastData.contentType,
    });

    // Download audio file from Storage
    logger.info(`[processPodcast] Step 3: Downloading audio file from Storage`);
    logger.info(`[processPodcast] Storage bucket: ${bucket.name}`);
    logger.info(`[processPodcast] File path: ${storagePath}`);

    const file = bucket.file(storagePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File does not exist in storage: ${storagePath}`);
    }
    logger.info(`[processPodcast] ✅ File exists in storage`);

    const [audioBuffer] = await file.download();
    logger.info(`[processPodcast] ✅ Downloaded ${audioBuffer.length} bytes (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Process with Gemini
    logger.info(`[processPodcast] Step 4: Sending to Gemini for processing...`);
    logger.info(`[processPodcast] Audio buffer size: ${audioBuffer.length} bytes`);
    const article = await processAudioWithGemini(audioBuffer);
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
    const articleData = {
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

    // Increment user quota
    logger.info(`[processPodcast] Step 7: Incrementing user quota`);
    try {
      // Get current user data to check tier
      const userDoc = await db.collection("users").doc(podcastData.userId).get();
      const userData = userDoc.data();
      const isFree = !userData?.tier || userData?.tier === "free";

      // Update quota - increment both used and freeLifetimeUsed for free tier
      const updateData: any = {
        "quota.used": FieldValue.increment(1),
      };

      if (isFree) {
        updateData["quota.freeLifetimeUsed"] = FieldValue.increment(1);
        logger.info(`[processPodcast] User is on free tier, incrementing freeLifetimeUsed`);
      }

      await db.collection("users").doc(podcastData.userId).update(updateData);
      logger.info(`[processPodcast] ✅ Incremented quota for user ${podcastData.userId}`);
    } catch (quotaError: any) {
      logger.error(`[processPodcast] ⚠️ Failed to increment quota:`, quotaError);
      // Don't fail the whole process if quota update fails
    }

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

    throw error;
  }
}
