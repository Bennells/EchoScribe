import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { processAudioWithVertexAI_LEGACY } from "../services/vertexai";
import { generateSlug } from "../utils/prompts";
import { config } from "../config/environment";
import { safeRefundQuota } from "../utils/quotaHelpers";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * HTTP Cloud Function (2nd Gen) for processing podcasts
 *
 * Features:
 * - 60-minute timeout for long podcasts (up to 4 hours)
 * - Zombie task prevention (checks if podcast exists)
 * - Automatic retry on 500 errors
 * - Direct invocation (no persistent queue)
 *
 * Benefits over Cloud Tasks:
 * - No zombie tasks (deleted podcasts won't process)
 * - Simpler architecture
 * - Lower costs
 */
export const processPodcastHttp = onRequest(
  {
    region: config.region,
    memory: "4GiB",
    cpu: 2,
    timeoutSeconds: 3600, // 60 minutes - supports podcasts up to 4 hours
    maxInstances: 3, // Limit concurrent processing (same as old rateLimits)
    // No secrets needed - uses Application Default Credentials (ADC) via WIF
  },
  async (req, res) => {
    // Only accept POST requests
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    const { podcastId, storagePath, userId } = req.body;

    // Validate required fields
    if (!podcastId || !storagePath || !userId) {
      logger.error("[HTTP] Missing required fields", {
        podcastId,
        storagePath,
        userId,
      });
      res.status(400).json({
        error: "Missing required fields: podcastId, storagePath, userId",
      });
      return;
    }

    logger.info("=".repeat(80));
    logger.info(`[HTTP] START - Processing podcast ${podcastId} | Storage: ${storagePath}`);
    logger.info("=".repeat(80));

    try {
      // ============================================
      // ZOMBIE PREVENTION: Check if podcast exists
      // ============================================
      logger.info(`[HTTP] Step 1: Checking if podcast document exists`);
      const podcastRef = db.collection("podcasts").doc(podcastId);
      const podcastDoc = await podcastRef.get();

      if (!podcastDoc.exists) {
        logger.info(`[HTTP] ⏭️  Podcast ${podcastId} not found - skipping (zombie prevention)`);
        // Return 200 to prevent retries
        res.status(200).json({
          status: "skipped",
          reason: "podcast not found",
          podcastId,
        });
        return;
      }

      const podcastData = podcastDoc.data();
      if (!podcastData) {
        throw new Error("Podcast data is empty");
      }

      // Check if already processing or completed
      if (podcastData.status === "completed") {
        logger.info(`[HTTP] ⏭️  Podcast ${podcastId} already completed - skipping`);
        res.status(200).json({
          status: "skipped",
          reason: "already completed",
          podcastId,
        });
        return;
      }

      if (podcastData.status === "processing") {
        logger.warn(`[HTTP] ⚠️  Podcast ${podcastId} already being processed - skipping`);
        res.status(200).json({
          status: "skipped",
          reason: "already processing",
          podcastId,
        });
        return;
      }

      // Update status to processing
      logger.info(`[HTTP] Step 2: Updating status to processing`);
      await podcastRef.update({
        status: "processing",
        processingStartedAt: FieldValue.serverTimestamp(),
      });
      logger.info(`[HTTP] ✅ Status updated | User: ${podcastData.userId} | Duration: ${podcastData.duration}min`);

      // ============================================
      // RESPOND IMMEDIATELY - Don't block storage trigger
      // ============================================
      logger.info(`[HTTP] Responding 202 Accepted - processing continues in background`);
      res.status(202).json({
        status: "accepted",
        podcastId,
        message: "Processing started",
      });

      // Continue processing in background (storage trigger can complete)

      // Verify audio file exists in Storage
      logger.info(`[HTTP] Step 3: Verifying audio file in storage`);
      const file = bucket.file(storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File does not exist in storage: ${storagePath}`);
      }

      const [metadata] = await file.getMetadata();
      const mimeType = metadata.contentType || podcastData.contentType || "audio/mpeg";
      const sizeMB = (parseInt(String(metadata.size || 0)) / 1024 / 1024).toFixed(2);

      logger.info(`[HTTP] ✅ File verified | Size: ${sizeMB}MB | Type: ${mimeType}`);

      // Process with Vertex AI (using optimized single-stage approach with Cloud Storage URI)
      logger.info(`[HTTP] Step 4: Processing with Vertex AI (Optimized Single-Stage)`);
      const article = await processAudioWithVertexAI_LEGACY(storagePath, mimeType);
      logger.info(`[HTTP] ✅ Article generated | Title: ${article.title}`);

      // Ensure slug is generated
      if (!article.slug) {
        article.slug = generateSlug(article.title);
        logger.info(`[HTTP] Generated slug: ${article.slug}`);
      }

      // Save article to Firestore
      logger.info(`[HTTP] Step 5: Saving results to Firestore`);
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
      }

      if (article.showNotes) {
        articleData.showNotes = article.showNotes;
      }

      const articleRef = await db.collection("articles").add(articleData);

      logger.info(`[HTTP] ✅ Results saved | Article ID: ${articleRef.id}`);

      // Update podcast status to completed
      logger.info(`[HTTP] Step 6: Updating podcast status to completed`);
      await podcastRef.update({
        status: "completed",
        articleId: articleRef.id,
        processingCompletedAt: FieldValue.serverTimestamp(),
      });
      logger.info(`[HTTP] ✅ Status updated to completed`);

      logger.info("=".repeat(80));
      logger.info(`[HTTP] ✅ COMPLETED - Processing finished successfully`);
      logger.info("=".repeat(80));
    } catch (error: any) {
      logger.error("=".repeat(80));
      logger.error(`[HTTP] ❌ ERROR - Processing failed for podcast ${podcastId}:`, {
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code,
        errorDetails: error.details || error.response?.data,
        storagePath,
      });
      logger.error("=".repeat(80));

      // Update status to error with detailed information
      try {
        logger.info(`[HTTP] Updating podcast status to 'error'`);
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
        logger.info(`[HTTP] ✅ Updated podcast ${podcastId} status to error`);
      } catch (updateError: any) {
        logger.error(`[HTTP] ❌ Failed to update podcast status to error:`, {
          updateErrorMessage: updateError.message,
          updateErrorCode: updateError.code,
        });
      }

      // ============================================
      // REFUND QUOTA - User should not lose quota on errors
      // ============================================
      const podcastData = (await db.collection("podcasts").doc(podcastId).get()).data();
      if (podcastData?.userId && podcastData?.duration) {
        logger.info(`[HTTP] Refunding quota: ${podcastData.duration} minutes`);
        try {
          await safeRefundQuota(
            podcastData.userId,
            podcastData.duration,
            `Processing failed: ${error.message}`
          );
          logger.info(`[HTTP] ✅ Quota refunded successfully`);
        } catch (refundError: any) {
          logger.error(`[HTTP] ❌ Failed to refund quota:`, {
            refundError: refundError.message,
            userId: podcastData.userId,
            duration: podcastData.duration,
          });
        }
      } else {
        logger.warn(`[HTTP] Could not refund quota - missing userId or duration`);
      }
    }
  }
);
