import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  try {
    // Get the Firebase token from cookies
    const token = req.cookies.get("firebase-token")?.value;

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

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const customerId = userData?.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json(
        { error: "Kein Stripe-Kunde gefunden. Bitte erstellen Sie zuerst ein Abonnement." },
        { status: 400 }
      );
    }

    // Get return URL from request body or use default
    const body = await req.json();
    const returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings`;

    // Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error: any) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Erstellen der Portal-Sitzung" },
      { status: 500 }
    );
  }
}
