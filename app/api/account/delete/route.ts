import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2023-10-16",
});

export async function POST(request: NextRequest) {
  try {
    // Get the Firebase token from cookies
    const token = request.cookies.get("firebase-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    // Verify the token and get user info
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    console.log(`Starting account deletion for user: ${userId}`);

    // Step 1: Cancel Stripe subscription if exists
    console.log("Checking for active subscriptions...");
    const subscriptionsSnapshot = await adminDb
      .collection("subscriptions")
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .get();

    for (const doc of subscriptionsSnapshot.docs) {
      const subscriptionData = doc.data();
      const stripeSubscriptionId = subscriptionData.stripeSubscriptionId;

      if (stripeSubscriptionId) {
        try {
          console.log(`Canceling Stripe subscription: ${stripeSubscriptionId}`);
          await stripe.subscriptions.cancel(stripeSubscriptionId);
          console.log(`Stripe subscription canceled: ${stripeSubscriptionId}`);
        } catch (error: any) {
          console.error(`Error canceling Stripe subscription: ${error.message}`);
          // Continue with deletion even if Stripe cancellation fails
        }
      }
    }

    // Step 2: Delete all user's podcasts from Firestore
    console.log("Deleting podcasts from Firestore...");
    const podcastsSnapshot = await adminDb
      .collection("podcasts")
      .where("userId", "==", userId)
      .get();

    const podcastDeletePromises = podcastsSnapshot.docs.map((doc) =>
      doc.ref.delete()
    );
    await Promise.all(podcastDeletePromises);
    console.log(`Deleted ${podcastsSnapshot.size} podcast documents`);

    // Step 3: Delete all user's articles from Firestore
    console.log("Deleting articles from Firestore...");
    const articlesSnapshot = await adminDb
      .collection("articles")
      .where("userId", "==", userId)
      .get();

    const articleDeletePromises = articlesSnapshot.docs.map((doc) =>
      doc.ref.delete()
    );
    await Promise.all(articleDeletePromises);
    console.log(`Deleted ${articlesSnapshot.size} article documents`);

    // Step 4: Delete all subscriptions from Firestore
    console.log("Deleting subscriptions from Firestore...");
    const allSubscriptionsSnapshot = await adminDb
      .collection("subscriptions")
      .where("userId", "==", userId)
      .get();

    const subscriptionDeletePromises = allSubscriptionsSnapshot.docs.map((doc) =>
      doc.ref.delete()
    );
    await Promise.all(subscriptionDeletePromises);
    console.log(`Deleted ${allSubscriptionsSnapshot.size} subscription documents`);

    // Step 5: Delete subscription change history (audit logs)
    console.log("Deleting subscription change history from Firestore...");
    const subscriptionChangesSnapshot = await adminDb
      .collection("subscription_changes")
      .where("userId", "==", userId)
      .get();

    const subscriptionChangesDeletePromises = subscriptionChangesSnapshot.docs.map((doc) =>
      doc.ref.delete()
    );
    await Promise.all(subscriptionChangesDeletePromises);
    console.log(`Deleted ${subscriptionChangesSnapshot.size} subscription change records`);

    // Step 6: Delete payment failure history (audit logs)
    console.log("Deleting payment failure history from Firestore...");
    const paymentFailuresSnapshot = await adminDb
      .collection("payment_failures")
      .where("userId", "==", userId)
      .get();

    const paymentFailuresDeletePromises = paymentFailuresSnapshot.docs.map((doc) =>
      doc.ref.delete()
    );
    await Promise.all(paymentFailuresDeletePromises);
    console.log(`Deleted ${paymentFailuresSnapshot.size} payment failure records`);

    // Step 7: Delete all files from Storage
    console.log("Deleting files from Storage...");
    try {
      const bucket = adminStorage.bucket();
      const [files] = await bucket.getFiles({
        prefix: `podcasts/${userId}/`,
      });

      if (files.length > 0) {
        const fileDeletePromises = files.map((file) => file.delete());
        await Promise.all(fileDeletePromises);
        console.log(`Deleted ${files.length} files from Storage`);
      } else {
        console.log("No files found in Storage");
      }
    } catch (error: any) {
      console.error(`Error deleting files from Storage: ${error.message}`);
      // Continue with deletion even if Storage deletion fails
    }

    // Step 8: Delete user document from Firestore
    console.log("Deleting user document from Firestore...");
    await adminDb.collection("users").doc(userId).delete();
    console.log("User document deleted");

    // Step 9: Delete Firebase Auth account
    console.log("Deleting Firebase Auth account...");
    await adminAuth.deleteUser(userId);
    console.log("Firebase Auth account deleted");

    console.log(`Account deletion completed successfully for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Konto erfolgreich gelöscht",
    });
  } catch (error: any) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: `Fehler beim Löschen des Kontos: ${error.message}` },
      { status: 500 }
    );
  }
}
