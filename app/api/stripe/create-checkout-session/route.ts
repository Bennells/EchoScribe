import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

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
      starter: process.env.STRIPE_PRICE_ID_STARTER_MONTHLY?.trim(),
      professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY?.trim(),
      business: process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY?.trim(),
      // Legacy support for old Pro tier
      pro: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY?.trim() || process.env.STRIPE_PRICE_ID_PRO_MONTHLY?.trim(),
    };

    const priceId = priceIdMap[tier];

    if (!priceId) {
      return NextResponse.json(
        { error: "Ungültiger Plan oder fehlende Stripe-Preis-ID" },
        { status: 400 }
      );
    }

    // Get or create Stripe Customer
    let customerId: string = "";

    // First, check if user already has a customerId stored in Firestore
    const userDoc = await adminDb.collection("users").doc(userId).get();
    let existingCustomerId = userDoc.data()?.stripeCustomerId;

    if (existingCustomerId) {
      // Verify the customer still exists in Stripe
      try {
        await stripe.customers.retrieve(existingCustomerId);
        customerId = existingCustomerId;
        console.log("Using existing Stripe customer:", customerId);
      } catch (error) {
        console.log("Existing customer not found in Stripe, creating new one");
        existingCustomerId = undefined; // Will create new one below
      }
    }

    if (!existingCustomerId || !customerId) {
      // Check if a customer with this email already exists in Stripe
      const existingCustomers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
        console.log("Found existing Stripe customer by email:", customerId);
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            firebaseUID: userId,
          },
          preferred_locales: ["de"], // German language for emails
        });
        customerId = customer.id;
        console.log("Created new Stripe customer:", customerId);
        console.log("Customer email:", userEmail);
        console.log("Customer locale: de (German)");
      }

      // Store customer ID in Firestore
      await adminDb.collection("users").doc(userId).set(
        {
          stripeCustomerId: customerId,
        },
        { merge: true }
      );
    }

    // Create Stripe Checkout Session
    // IMPORTANT: Set to false for Kleinunternehmer (§ 19 UStG - no VAT)
    // If you become VAT-registered later, change this to true
    const enableStripeTax = false;

    // Detect if running in local development
    const origin = request.headers.get("origin") || "";
    const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");

    console.log("Creating checkout session:");
    console.log("- Origin:", origin);
    console.log("- Is localhost:", isLocalhost);
    console.log("- Tier:", tier);

    const sessionConfig: any = {
      customer: customerId, // Use customer ID instead of customer_email
      payment_method_types: ["card", "sepa_debit"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard/settings?success=true`,
      cancel_url: `${origin}/dashboard/settings?canceled=true`,
      metadata: {
        userId: userId,
        tier: tier,
      },
      subscription_data: {
        metadata: {
          userId: userId,
          tier: tier,
        },
      },
      // In subscription mode, payment method is automatically saved to the customer
      // and set as the default payment method for the subscription
    };

    // Only enable automatic tax and related features if enableStripeTax is true
    // For Kleinunternehmer (§ 19 UStG): Keep enableStripeTax = false (no VAT)
    // For regular VAT registration: Change enableStripeTax = true
    if (enableStripeTax) {
      sessionConfig.automatic_tax = { enabled: true };
      sessionConfig.customer_update = { address: "auto" };
      sessionConfig.tax_id_collection = { enabled: true };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout session error:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Checkout-Session" },
      { status: 500 }
    );
  }
}
