import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2023-10-16",
});

export async function GET(request: NextRequest) {
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

    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;

    if (!customer.invoice_settings?.default_payment_method) {
      return NextResponse.json({
        hasPaymentMethod: false,
        paymentMethod: null,
      });
    }

    // Retrieve the payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(
      customer.invoice_settings.default_payment_method as string
    );

    // Return safe payment method info (no sensitive data)
    return NextResponse.json({
      hasPaymentMethod: true,
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        } : null,
        sepaDebit: paymentMethod.sepa_debit ? {
          last4: paymentMethod.sepa_debit.last4,
          country: paymentMethod.sepa_debit.country,
        } : null,
      },
    });
  } catch (error: any) {
    console.error("Stripe get payment method error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Zahlungsmethode" },
      { status: 500 }
    );
  }
}
