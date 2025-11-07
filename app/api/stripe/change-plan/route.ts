import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { LAUNCH_SPECIAL_MODE } from "@/lib/constants/pricing";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2023-10-16",
});

// Map tier to Stripe price ID
function getTierPriceId(tier: string): string | undefined {
  const priceIdMap: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_ID_STARTER_MONTHLY?.trim(),
    professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY?.trim(),
    business: process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY?.trim(),
    // Legacy support for old Pro tier
    pro: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY?.trim() || process.env.STRIPE_PRICE_ID_PRO_MONTHLY?.trim(),
  };
  return priceIdMap[tier];
}

// Map tier to monthly quota
function getTierQuota(tier: string): number {
  const quotaMap: Record<string, number> = {
    free: 3,
    starter: 15,
    professional: 60,
    business: 150,
    // Legacy support
    pro: 60,
  };
  return quotaMap[tier] || 3;
}

export async function POST(request: NextRequest) {
  // Launch Special: Payment flows disabled
  if (LAUNCH_SPECIAL_MODE) {
    return NextResponse.json(
      { error: "Plan-Änderungen sind während der Launch Special Phase nicht verfügbar." },
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

    // Get the new tier from request body
    const body = await request.json();
    const newTier = body.tier;

    if (!newTier || !["starter", "professional", "business"].includes(newTier)) {
      return NextResponse.json(
        { error: "Ungültiger Plan" },
        { status: 400 }
      );
    }

    // Get the new price ID
    const newPriceId = getTierPriceId(newTier);
    if (!newPriceId) {
      return NextResponse.json(
        { error: "Preis-ID für Plan nicht gefunden" },
        { status: 500 }
      );
    }

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
    const currentTier = subscriptionData.tier;

    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Stripe-Abonnement nicht gefunden" },
        { status: 404 }
      );
    }

    // Check if trying to switch to same tier
    if (currentTier === newTier) {
      return NextResponse.json(
        { error: "Sie haben bereits diesen Plan" },
        { status: 400 }
      );
    }

    // Retrieve the subscription from Stripe to get the subscription item ID
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    if (!stripeSubscription.items.data[0]) {
      return NextResponse.json(
        { error: "Abonnement-Element nicht gefunden" },
        { status: 500 }
      );
    }

    const subscriptionItemId = stripeSubscription.items.data[0].id;

    // Create idempotency key to prevent duplicate plan changes
    const idempotencyKey = `change-plan-${userId}-${newTier}-${Date.now()}`;

    // Update the subscription in Stripe with the new price
    const updatedSubscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        items: [
          {
            id: subscriptionItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: "always_invoice", // Create prorated invoice immediately
        metadata: {
          tier: newTier,
        },
      },
      {
        idempotencyKey,
      }
    );

    // Update Firestore immediately with the new tier
    const newQuota = getTierQuota(newTier);

    // Update subscription document
    await subscriptionDoc.ref.update({
      tier: newTier,
      priceId: newPriceId,
      currentPeriodStart: Timestamp.fromMillis(updatedSubscription.current_period_start * 1000),
      currentPeriodEnd: Timestamp.fromMillis(updatedSubscription.current_period_end * 1000),
    });

    // Update user document
    await adminDb.collection("users").doc(userId).update({
      tier: newTier,
      "quota.monthly": newQuota,
    });

    return NextResponse.json({
      success: true,
      tier: newTier,
      currentPeriodEnd: updatedSubscription.current_period_end,
      message: "Plan erfolgreich geändert",
    });
  } catch (error: any) {
    console.error("Stripe change plan error:", error);

    // Handle specific Stripe errors
    if (error.type === "StripeCardError") {
      return NextResponse.json(
        { error: "Kartenfehler: " + error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Fehler beim Ändern des Plans" },
      { status: 500 }
    );
  }
}
