import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

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

    // Check if subscription is already set to cancel
    if (subscriptionData.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "Abonnement ist bereits zur Kündigung vorgemerkt" },
        { status: 400 }
      );
    }

    // Cancel the subscription at period end via Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Update Firestore immediately with cancellation info
    await subscriptionDoc.ref.update({
      cancelAtPeriodEnd: true,
      canceledAt: Timestamp.now(),
    });

    // Return the period end date for display
    return NextResponse.json({
      success: true,
      cancelAt: updatedSubscription.current_period_end,
      message: "Abonnement wird am Ende der Laufzeit gekündigt",
    });
  } catch (error: any) {
    console.error("Stripe cancel subscription error:", error);
    return NextResponse.json(
      { error: "Fehler beim Kündigen des Abonnements" },
      { status: 500 }
    );
  }
}
