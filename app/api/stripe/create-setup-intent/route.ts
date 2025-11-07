import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { LAUNCH_SPECIAL_MODE } from "@/lib/constants/pricing";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2023-10-16",
});

export async function POST(request: NextRequest) {
  // Launch Special: Payment flows disabled
  if (LAUNCH_SPECIAL_MODE) {
    return NextResponse.json(
      { error: "Zahlungsmethoden können während der Launch Special Phase nicht verwaltet werden." },
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

    // Get user's Stripe customer ID from Firestore
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const stripeCustomerId = userDoc.data()?.stripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Stripe-Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    // Create a SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card", "sepa_debit"],
      usage: "off_session", // Allow charging the customer when they're not present
      metadata: {
        userId: userId,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error: any) {
    console.error("Stripe setup intent error:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Setup-Intents" },
      { status: 500 }
    );
  }
}
