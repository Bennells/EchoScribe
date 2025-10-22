import * as functions from "firebase-functions/v2/identity";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const onUserCreate = functions.beforeUserCreated(async (event) => {
  const user = event.data;

  // Calculate first quota reset date (1st of next month)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Create user document in Firestore
  await db.collection("users").doc(user.uid).set({
    email: user.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    subscriptionStatus: "free",
    quota: {
      monthly: 3, // Free tier: 3 podcasts/month
      used: 0,
      resetAt: admin.firestore.Timestamp.fromDate(nextMonth),
    },
  });

  logger.info(`User document created for ${user.uid}`);
});
