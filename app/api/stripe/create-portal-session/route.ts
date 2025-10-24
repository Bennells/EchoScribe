import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
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
    // In emulator mode, skip verification as emulator tokens don't have "kid" claim
    const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
    let decodedToken: { uid: string };

    if (isEmulator) {
      // Decode without verification for emulator
      const base64Payload = token.split(".")[1];
      const payload = Buffer.from(base64Payload, "base64").toString();
      decodedToken = JSON.parse(payload);
    } else {
      // Verify token in production
      decodedToken = await adminAuth.verifyIdToken(token);
    }

    const userId = decodedToken.uid;

    // Get user's Stripe customer ID from Firestore
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

    const subscriptionData = snapshot.docs[0].data();
    const customerId = subscriptionData.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json(
        { error: "Stripe-Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    // Create Stripe Customer Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${request.headers.get("origin")}/dashboard/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe portal session error:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Portal-Session" },
      { status: 500 }
    );
  }
}
