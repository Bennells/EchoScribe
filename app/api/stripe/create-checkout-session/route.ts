import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth } from "@/lib/firebase/admin";

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

    console.log("Creating checkout session for user:", userId, userEmail);

    if (!userEmail) {
      return NextResponse.json(
        { error: "Benutzer-E-Mail nicht gefunden" },
        { status: 400 }
      );
    }

    // Get tier from request body (defaults to "professional" for backward compatibility)
    const body = await request.json().catch(() => ({}));
    const tier = body.tier || "professional";

    // Map tier to Stripe price ID
    const priceIdMap: Record<string, string | undefined> = {
      starter: process.env.STRIPE_PRICE_ID_STARTER_MONTHLY,
      professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY,
      business: process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY,
      // Legacy support for old Pro tier
      pro: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY || process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
    };

    const priceId = priceIdMap[tier];

    if (!priceId) {
      return NextResponse.json(
        { error: "Ungültiger Plan oder fehlende Stripe-Preis-ID" },
        { status: 400 }
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer_email: userEmail,
      payment_method_types: ["card", "sepa_debit"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${request.headers.get("origin")}/dashboard/settings?success=true`,
      cancel_url: `${request.headers.get("origin")}/dashboard/settings?canceled=true`,
      metadata: {
        userId: userId,
        tier: tier,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout session error:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Checkout-Session" },
      { status: 500 }
    );
  }
}
