import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { parseBuffer } from "music-metadata";
import { captureException } from "../lib/sentry";
import { enqueuePodcastProcessing } from "../lib/taskQueue";
import { config } from "../config/environment";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

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
      // Extract userId from path: podcasts/{userId}/{timestamp}_{duration}min_{filename}
      const pathParts = filePath.split("/");
      logger.info(`[onPodcastUploaded] Path parts: ${JSON.stringify(pathParts)}`);

      if (pathParts.length < 3) {
        logger.error(`[onPodcastUploaded] Invalid path format: ${filePath}`);
        return;
      }

      const userId = pathParts[1];
      const fileNameWithPrefix = pathParts[2];

      // Extract duration from filename: {timestamp}_{duration}min_{filename}
      const durationMatch = fileNameWithPrefix.match(/^\d+_(\d+)min_/);
      const duration = durationMatch ? parseInt(durationMatch[1], 10) : 0;

      // Remove timestamp and duration prefix from filename
      // Use a more robust method: find the position after "min_" and take everything after it
      const minIndex = fileNameWithPrefix.indexOf("min_");
      const fileName = minIndex !== -1 ? fileNameWithPrefix.substring(minIndex + 4) : fileNameWithPrefix;

      logger.info(`[onPodcastUploaded] Extracted userId: ${userId}, fileName: ${fileName}, duration: ${duration} minutes`);

      // ============================================
      // Server-side duration validation
      // ============================================
      logger.info(`[onPodcastUploaded] Validating audio duration server-side...`);

      let serverDuration = duration; // Fallback to client duration
      let clientDuration = duration;
      let durationVerified = false;

      try {
        // Download audio file for analysis
        const file = bucket.file(filePath);
        const [audioBuffer] = await file.download();

        logger.info(`[onPodcastUploaded] Downloaded audio file (${audioBuffer.length} bytes)`);

        // Extract duration using music-metadata
        const metadata = await parseBuffer(audioBuffer, contentType || "audio/mpeg");

        if (metadata.format.duration) {
          // Convert seconds to minutes (round up)
          const serverDurationMinutes = Math.ceil(metadata.format.duration / 60);
          serverDuration = serverDurationMinutes;
          durationVerified = true;

          // Calculate discrepancy
          const difference = Math.abs(serverDurationMinutes - clientDuration);
          const percentDiff = clientDuration > 0 ? (difference / serverDurationMinutes) * 100 : 0;

          logger.info(`[onPodcastUploaded] Duration verification:`, {
            clientReported: clientDuration,
            serverMeasured: serverDurationMinutes,
            difference,
            percentDiff: percentDiff.toFixed(2) + "%",
            format: metadata.format.codec,
            bitrate: metadata.format.bitrate,
          });

          // Log warning for significant discrepancies
          if (percentDiff > 5) {
            logger.warn(`[onPodcastUploaded] ⚠️ Significant duration discrepancy detected!`, {
              userId,
              fileName,
              clientDuration,
              serverDuration: serverDurationMinutes,
              percentDiff: percentDiff.toFixed(2) + "%",
            });

            // Report to Sentry for monitoring
            if (percentDiff > 15) {
              captureException(new Error("Large audio duration mismatch"), {
                functionName: "onPodcastUploaded",
                extra: {
                  userId,
                  fileName,
                  clientDuration,
                  serverDuration: serverDurationMinutes,
                  percentDiff,
                  filePath,
                },
              });
            }
          }

          logger.info(`[onPodcastUploaded] ✅ Duration verified: ${serverDurationMinutes} minutes`);
        } else {
          logger.warn(`[onPodcastUploaded] Could not extract duration from metadata`);
        }
      } catch (metadataError: any) {
        logger.error(`[onPodcastUploaded] Error extracting metadata:`, {
          errorMessage: metadataError.message,
          errorStack: metadataError.stack,
        });
        // Continue with client-reported duration as fallback
      }

      // ============================================
      // Atomic Quota Reservation with Transaction
      // ============================================
      logger.info(`[onPodcastUploaded] Starting atomic quota reservation...`);

      const file = bucket.file(filePath);
      const podcastRef = db.collection("podcasts").doc(); // Pre-generate ID
      const podcastId = podcastRef.id;

      try {
        await db.runTransaction(async (transaction) => {
          // Get current user quota
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists) {
            throw new Error(`User document not found: ${userId}`);
          }

          const userData = userDoc.data()!;
          const currentUsed = userData.quota?.used || 0;
          const monthlyLimit = userData.quota?.monthly || 0;
          const newUsed = currentUsed + serverDuration;

          logger.info(`[onPodcastUploaded] Quota check:`, {
            currentUsed,
            monthlyLimit,
            requiredMinutes: serverDuration,
            newTotal: newUsed,
          });

          // ============================================
          // Check if quota exceeded
          // ============================================
          if (newUsed > monthlyLimit) {
            logger.warn(`[onPodcastUploaded] ⚠️ QUOTA EXCEEDED!`, {
              userId,
              fileName,
              currentUsed,
              monthlyLimit,
              required: serverDuration,
              wouldBe: newUsed,
            });

            // Delete uploaded file immediately
            logger.info(`[onPodcastUploaded] Deleting file due to quota exceeded: ${filePath}`);
            await file.delete();

            // Create podcast document with quota_exceeded status
            const quotaExceededData = {
              userId,
              fileName,
              fileSize,
              duration: serverDuration,
              clientReportedDuration: clientDuration,
              durationVerified,
              contentType: contentType || "audio/mpeg",
              storagePath: filePath, // For reference (file is deleted)
              status: "quota_exceeded",
              errorMessage: `Quota überschritten: ${newUsed}/${monthlyLimit} Min. Verfügbar waren: ${monthlyLimit - currentUsed} Min.`,
              uploadedAt: FieldValue.serverTimestamp(),
              errorAt: FieldValue.serverTimestamp(),
            };

            transaction.set(podcastRef, quotaExceededData);

            // Report to Sentry for monitoring
            captureException(new Error("Quota exceeded during upload"), {
              functionName: "onPodcastUploaded",
              extra: {
                userId,
                fileName,
                currentUsed,
                monthlyLimit,
                required: serverDuration,
                available: monthlyLimit - currentUsed,
              },
            });

            logger.info(`[onPodcastUploaded] ✅ Created quota_exceeded document: ${podcastId}`);
            return; // Exit transaction - no processing needed
          }

          // ============================================
          // Quota available - reserve immediately
          // ============================================
          logger.info(`[onPodcastUploaded] ✅ Quota available - reserving ${serverDuration} minutes`);

          // Increment quota atomically
          transaction.update(userRef, {
            "quota.used": FieldValue.increment(serverDuration),
          });

          // Create podcast document with queued status
          const podcastData = {
            userId,
            fileName,
            fileSize,
            duration: serverDuration, // Use server-verified duration
            clientReportedDuration: clientDuration, // Store what client said
            durationVerified, // Flag indicating server verification
            contentType: contentType || "audio/mpeg",
            storagePath: filePath,
            status: "queued",
            uploadedAt: FieldValue.serverTimestamp(),
            queuedAt: FieldValue.serverTimestamp(),
          };

          transaction.set(podcastRef, podcastData);

          logger.info(`[onPodcastUploaded] ✅ Quota reserved and podcast created: ${podcastId}`);
        });

        // Transaction completed successfully
        logger.info(`[onPodcastUploaded] ✅ Transaction completed for: ${podcastId}`);

        // Check podcast status to determine if processing should be enqueued
        const podcastDoc = await podcastRef.get();
        const podcastStatus = podcastDoc.data()?.status;

        if (podcastStatus === "quota_exceeded") {
          logger.info(`[onPodcastUploaded] ⏭️  Skipping processing - quota exceeded for: ${podcastId}`);
          logger.info("=".repeat(80));
          return; // Exit - no processing for quota exceeded uploads
        }

        // ============================================
        // Post-transaction verification (catch race conditions)
        // ============================================
        logger.info(`[onPodcastUploaded] Performing post-transaction quota verification...`);
        const userRef = db.collection("users").doc(userId);
        const postTxUserDoc = await userRef.get();
        const postTxUserData = postTxUserDoc.data();

        if (postTxUserData) {
          const finalUsed = postTxUserData.quota?.used || 0;
          const monthlyLimit = postTxUserData.quota?.monthly || 0;

          // If quota now exceeded (race condition), rollback this upload
          if (finalUsed > monthlyLimit) {
            logger.warn(`[onPodcastUploaded] ⚠️ POST-TRANSACTION QUOTA EXCEEDED DETECTED!`, {
              userId,
              fileName,
              finalUsed,
              monthlyLimit,
              excess: finalUsed - monthlyLimit,
            });

            // Rollback: Delete file, refund quota, mark as quota_exceeded
            try {
              await file.delete();
              logger.info(`[onPodcastUploaded] ✅ Deleted file due to post-transaction quota exceeded`);
            } catch (deleteError: any) {
              logger.error(`[onPodcastUploaded] ⚠️ Failed to delete file:`, deleteError);
            }

            // Refund quota
            await userRef.update({
              "quota.used": FieldValue.increment(-serverDuration),
            });
            logger.info(`[onPodcastUploaded] ✅ Refunded ${serverDuration} minutes`);

            // Update podcast status
            await podcastRef.update({
              status: "quota_exceeded",
              errorMessage: `Quota überschritten durch gleichzeitige Uploads: ${finalUsed}/${monthlyLimit} Min.`,
              errorAt: FieldValue.serverTimestamp(),
            });
            logger.info(`[onPodcastUploaded] ✅ Updated podcast to quota_exceeded status`);

            // Report to Sentry
            captureException(new Error("Race condition: Quota exceeded after transaction"), {
              functionName: "onPodcastUploaded",
              extra: {
                userId,
                fileName,
                finalUsed,
                monthlyLimit,
                excess: finalUsed - monthlyLimit,
              },
            });

            logger.info("=".repeat(80));
            return; // Exit - don't process this upload
          }

          logger.info(`[onPodcastUploaded] ✅ Post-transaction verification passed: ${finalUsed}/${monthlyLimit} Min.`);
        }

        // Enqueue processing task (handles long-running Gemini API call)
        logger.info(`[onPodcastUploaded] Enqueueing processing task for: ${podcastId}`);

        try {
          await enqueuePodcastProcessing(podcastId, filePath);
          logger.info(`[onPodcastUploaded] ✅ Task enqueued successfully`);
        } catch (enqueueError: any) {
          logger.error(`[onPodcastUploaded] ❌ Failed to enqueue task:`, enqueueError);

          // Refund quota since processing failed to start
          logger.info(`[onPodcastUploaded] Refunding quota: ${serverDuration} minutes`);
          await db.collection("users").doc(userId).update({
            "quota.used": FieldValue.increment(-serverDuration),
          });

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
      } catch (transactionError: any) {
        logger.error(`[onPodcastUploaded] ❌ Transaction failed:`, transactionError);
        throw transactionError;
      }
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
