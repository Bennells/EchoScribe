import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { LAUNCH_SPECIAL_MODE } from "@/lib/constants/pricing";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2023-10-16",
});

export async function POST(request: NextRequest) {
  // Launch Special: Payment flows disabled
  if (LAUNCH_SPECIAL_MODE) {
    return NextResponse.json(
      { error: "Keine aktiven Abonnements während der Launch Special Phase." },
      { status: 503 }
    );
  }

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

    // Get user's active subscription from Firestore
    const subscriptionsRef = adminDb.collection("subscriptions");
    const snapshot = await subscriptionsRef
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Kein aktives Abonnement gefunden" },
        { status: 404 }
      );
    }

    const subscriptionDoc = snapshot.docs[0];
    const subscriptionData = subscriptionDoc.data();
    const stripeSubscriptionId = subscriptionData.stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Stripe-Abonnement nicht gefunden" },
        { status: 404 }
      );
    }

    // Check if subscription is actually set to cancel
    if (!subscriptionData.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "Abonnement ist nicht zur Kündigung vorgemerkt" },
        { status: 400 }
      );
    }

    // Reactivate the subscription by removing cancel_at_period_end
    const updatedSubscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    // Update Firestore immediately with reactivation info
    await subscriptionDoc.ref.update({
      cancelAtPeriodEnd: false,
      canceledAt: FieldValue.delete(),
    });

    return NextResponse.json({
      success: true,
      message: "Abonnement wurde reaktiviert",
    });
  } catch (error: any) {
    console.error("Stripe reactivate subscription error:", error);
    return NextResponse.json(
      { error: "Fehler beim Reaktivieren des Abonnements" },
      { status: 500 }
    );
  }
}
