import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import { captureException, setUser, clearUser } from "../lib/sentry";
import { config } from "../config/environment";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2023-10-16",
});

export const deleteUserAccount = onCall(
  {
    region: config.region, // ✅ Automatisch: TEST=europe-west1, PROD=europe-west3
  },
  async (request) => {
    // Check authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email;

    // Set user context for Sentry
    setUser(userId, userEmail);

    logger.info(`Starting account deletion for user: ${userId}`);

    try {
      const db = admin.firestore();
      const storage = admin.storage();

      // Step 1: Cancel Stripe subscription if exists
      logger.info("Checking for active subscriptions...");
      const subscriptionsSnapshot = await db
        .collection("subscriptions")
        .where("userId", "==", userId)
        .where("status", "==", "active")
        .get();

      for (const doc of subscriptionsSnapshot.docs) {
        const subscriptionData = doc.data();
        const stripeSubscriptionId = subscriptionData.stripeSubscriptionId;

        if (stripeSubscriptionId) {
          try {
            logger.info(`Canceling Stripe subscription: ${stripeSubscriptionId}`);
            await stripe.subscriptions.cancel(stripeSubscriptionId);
            logger.info(`Stripe subscription canceled: ${stripeSubscriptionId}`);
          } catch (error: any) {
            logger.error(`Error canceling Stripe subscription: ${error.message}`);
            
            // Report to Sentry but continue
            captureException(error, {
              functionName: "deleteUserAccount",
              userId,
              extra: {
                step: "cancel_stripe_subscription",
                stripeSubscriptionId,
              },
            });
          }
        }
      }

      // Step 2: Delete all user's podcasts from Firestore
      logger.info("Deleting podcasts from Firestore...");
      const podcastsSnapshot = await db
        .collection("podcasts")
        .where("userId", "==", userId)
        .get();

      const podcastDeletePromises = podcastsSnapshot.docs.map((doc) =>
        doc.ref.delete()
      );
      await Promise.all(podcastDeletePromises);
      logger.info(`Deleted ${podcastsSnapshot.size} podcast documents`);

      // Step 3: Delete all user's articles from Firestore
      logger.info("Deleting articles from Firestore...");
      const articlesSnapshot = await db
        .collection("articles")
        .where("userId", "==", userId)
        .get();

      const articleDeletePromises = articlesSnapshot.docs.map((doc) =>
        doc.ref.delete()
      );
      await Promise.all(articleDeletePromises);
      logger.info(`Deleted ${articlesSnapshot.size} article documents`);

      // Step 4: Delete all subscriptions from Firestore
      logger.info("Deleting subscriptions from Firestore...");
      const allSubscriptionsSnapshot = await db
        .collection("subscriptions")
        .where("userId", "==", userId)
        .get();

      const subscriptionDeletePromises = allSubscriptionsSnapshot.docs.map((doc) =>
        doc.ref.delete()
      );
      await Promise.all(subscriptionDeletePromises);
      logger.info(`Deleted ${allSubscriptionsSnapshot.size} subscription documents`);

      // Step 5: Delete all files from Storage
      logger.info("Deleting files from Storage...");
      try {
        const bucket = storage.bucket();
        const [files] = await bucket.getFiles({
          prefix: `podcasts/${userId}/`,
        });

        if (files.length > 0) {
          const fileDeletePromises = files.map((file) => file.delete());
          await Promise.all(fileDeletePromises);
          logger.info(`Deleted ${files.length} files from Storage`);
        } else {
          logger.info("No files found in Storage");
        }
      } catch (error: any) {
        logger.error(`Error deleting files from Storage: ${error.message}`);
        
        // Report to Sentry but continue
        captureException(error, {
          functionName: "deleteUserAccount",
          userId,
          extra: {
            step: "delete_storage_files",
          },
        });
      }

      // Step 6: Delete user document from Firestore
      logger.info("Deleting user document from Firestore...");
      await db.collection("users").doc(userId).delete();
      logger.info("User document deleted");

      // Step 7: Delete Firebase Auth account
      logger.info("Deleting Firebase Auth account...");
      await admin.auth().deleteUser(userId);
      logger.info("Firebase Auth account deleted");

      logger.info(`Account deletion completed successfully for user: ${userId}`);

      // Clear user context
      clearUser();

      return {
        success: true,
        message: "Account deleted successfully",
      };
    } catch (error: any) {
      logger.error(`Error deleting account: ${error.message}`, error);
      
      // Report to Sentry
      captureException(error, {
        functionName: "deleteUserAccount",
        userId,
        extra: {
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
      
      throw new HttpsError("internal", `Failed to delete account: ${error.message}`);
    }
  }
);
