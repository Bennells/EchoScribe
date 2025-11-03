import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || "").trim(), {
  apiVersion: "2023-10-16",
});

const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);

      // Report signature verification failures to Sentry (production only)
      if (process.env.NODE_ENV === "production") {
        Sentry.captureException(err, {
          tags: {
            webhook_event: "signature_verification_failed",
          },
          extra: {
            hasSignature: !!signature,
            hasSecret: !!webhookSecret,
          },
        });
      }

      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    console.log("Webhook event received:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        console.log("Processing checkout.session.completed event");
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        console.log("Processing customer.subscription.updated event");
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        console.log("Processing customer.subscription.deleted event");
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        console.log("Processing invoice.payment_failed event");
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);

    // Report webhook handler errors to Sentry (production only)
    if (process.env.NODE_ENV === "production") {
      Sentry.captureException(error, {
        tags: {
          webhook_handler: "stripe",
        },
        extra: {
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
    }

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  console.log("=== CHECKOUT SESSION COMPLETED ===");
  console.log("Session ID:", session.id);

  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier || "professional"; // Default to professional for backward compatibility
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  console.log("Metadata - userId:", userId);
  console.log("Metadata - tier:", tier);
  console.log("Subscription ID:", subscriptionId);
  console.log("Customer ID:", customerId);

  if (!userId || !subscriptionId) {
    console.error("ERROR: Missing userId or subscriptionId in session metadata");
    return;
  }

  // Retrieve the subscription details to get the default payment method
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method"],
  });

  // Extract payment method details if available
  let paymentMethodData: any = null;
  if (subscription.default_payment_method) {
    const paymentMethod = subscription.default_payment_method as Stripe.PaymentMethod;

    console.log("Payment method found:", paymentMethod.id);
    console.log("Payment method type:", paymentMethod.type);

    // Store relevant payment method information
    paymentMethodData = {
      id: paymentMethod.id,
      type: paymentMethod.type,
      created: paymentMethod.created,
    };

    // Add type-specific details
    if (paymentMethod.type === "card" && paymentMethod.card) {
      paymentMethodData.card = {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      };
      console.log("Card details:", paymentMethodData.card);
    } else if (paymentMethod.type === "sepa_debit" && paymentMethod.sepa_debit) {
      paymentMethodData.sepa_debit = {
        last4: paymentMethod.sepa_debit.last4,
        bankCode: paymentMethod.sepa_debit.bank_code,
        country: paymentMethod.sepa_debit.country,
      };
      console.log("SEPA details:", paymentMethodData.sepa_debit);
    }
  } else {
    console.log("No default payment method found on subscription");
  }

  // Map tier to quota limits
  const quotaLimits: Record<string, number> = {
    starter: 15,
    professional: 60,
    business: 150,
    pro: 60, // Legacy support
  };

  const monthlyQuota = quotaLimits[tier] || 60;

  // Create subscription document in Firestore
  const subscriptionData: any = {
    userId: userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: subscription.status,
    priceId: subscription.items.data[0].price.id,
    tier: tier,
    currentPeriodStart: Timestamp.fromMillis(Math.floor(subscription.current_period_start * 1000)),
    currentPeriodEnd: Timestamp.fromMillis(Math.floor(subscription.current_period_end * 1000)),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Add payment method if available
  if (paymentMethodData) {
    subscriptionData.paymentMethod = paymentMethodData;
    console.log("Payment method will be saved to Firestore");
  }

  console.log("Attempting to create subscription document in Firestore...");
  try {
    await adminDb
      .collection("subscriptions")
      .doc(subscriptionId)
      .set(subscriptionData);

    console.log("✅ Subscription created in Firestore:", subscriptionId);
  } catch (error) {
    console.error("❌ ERROR creating subscription in Firestore:", error);
    throw error;
  }

  // Update user document to reflect subscription and set quota
  console.log("Attempting to update user document in Firestore...");
  try {
    // Get current user data to preserve freeLifetimeUsed
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const freeLifetimeUsed = userData?.quota?.freeLifetimeUsed || 0;

    await adminDb
      .collection("users")
      .doc(userId)
      .update({
        subscriptionStatus: subscription.status,
        tier: tier,
        "quota.monthly": monthlyQuota,
        "quota.used": 0, // Reset usage when new subscription starts
        "quota.freeLifetimeUsed": freeLifetimeUsed, // Preserve free tier usage history
        "quota.resetAt": Timestamp.fromMillis(Math.floor(subscription.current_period_end * 1000)),
        updatedAt: FieldValue.serverTimestamp(),
      });

    console.log(
      `✅ User subscription status and tier updated: ${userId}, ${tier} (preserved freeLifetimeUsed: ${freeLifetimeUsed})`
    );
  } catch (error) {
    console.error("❌ ERROR updating user in Firestore:", error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("Subscription updated:", subscription.id);

  const subscriptionId = subscription.id;

  // Get userId and tier from subscription document first
  const subscriptionDoc = await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .get();

  if (!subscriptionDoc.exists) {
    console.log("Subscription document doesn't exist yet, skipping update:", subscriptionId);
    return; // Skip if subscription document hasn't been created yet
  }

  // Debug logging
  console.log("Current period start:", subscription.current_period_start, "Type:", typeof subscription.current_period_start);
  console.log("Current period end:", subscription.current_period_end, "Type:", typeof subscription.current_period_end);

  // Update subscription document in Firestore - only include fields that exist
  const subscriptionData: any = {
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Only add timestamp fields if they exist
  if (subscription.current_period_start) {
    subscriptionData.currentPeriodStart = Timestamp.fromMillis(Math.floor(subscription.current_period_start * 1000));
  }
  if (subscription.current_period_end) {
    subscriptionData.currentPeriodEnd = Timestamp.fromMillis(Math.floor(subscription.current_period_end * 1000));
  }

  await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .update(subscriptionData);

  if (subscriptionDoc.exists) {
    const userId = subscriptionDoc.data()?.userId;
    const tier = subscriptionDoc.data()?.tier || "professional";

    if (userId) {
      // Update user document
      const userUpdate: any = {
        subscriptionStatus: subscription.status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Only update quota reset time if current_period_end exists
      if (subscription.current_period_end) {
        // Check if it's the start of a new billing period (quota reset)
        const userDoc = await adminDb.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const previousPeriodEnd = userData?.quota?.resetAt?.toDate();
        const newPeriodEnd = Timestamp.fromMillis(Math.floor(subscription.current_period_end * 1000));

        const shouldResetQuota =
          !previousPeriodEnd ||
          newPeriodEnd.toMillis() > previousPeriodEnd.getTime();

        userUpdate["quota.resetAt"] = newPeriodEnd;

        // Reset quota if it's a new billing period
        if (shouldResetQuota) {
          userUpdate["quota.used"] = 0;
          console.log("Resetting quota for user:", userId);
        }
      }

      await adminDb
        .collection("users")
        .doc(userId)
        .update(userUpdate);

      console.log("User subscription status updated:", userId);
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("Subscription deleted:", subscription.id);

  const subscriptionId = subscription.id;

  // Get userId from subscription document before updating
  const subscriptionDoc = await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .get();

  if (subscriptionDoc.exists) {
    const userId = subscriptionDoc.data()?.userId;

    // Update subscription status to canceled
    await adminDb
      .collection("subscriptions")
      .doc(subscriptionId)
      .update({
        status: "canceled",
        updatedAt: FieldValue.serverTimestamp(),
      });

    if (userId) {
      // Get current user data to preserve freeLifetimeUsed
      const userDoc = await adminDb.collection("users").doc(userId).get();
      const userData = userDoc.data();
      const freeLifetimeUsed = userData?.quota?.freeLifetimeUsed || 0;

      // Revert user to free tier - restore original free tier usage
      await adminDb
        .collection("users")
        .doc(userId)
        .update({
          subscriptionStatus: "canceled",
          tier: "free",
          "quota.monthly": 3,
          "quota.used": freeLifetimeUsed, // Restore original free tier usage
          updatedAt: FieldValue.serverTimestamp(),
        });

      console.log(
        `User subscription canceled and reverted to free tier: ${userId} (freeLifetimeUsed: ${freeLifetimeUsed})`
      );
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("=== INVOICE PAYMENT FAILED ===");
  console.log("Invoice ID:", invoice.id);
  console.log("Customer ID:", invoice.customer);
  console.log("Subscription ID:", invoice.subscription);
  console.log("Amount due:", invoice.amount_due);
  console.log("Attempt count:", invoice.attempt_count);

  const subscriptionId = invoice.subscription as string;
  const customerId = invoice.customer as string;

  if (!subscriptionId) {
    console.log("No subscription ID found in failed invoice");
    return;
  }

  // Find the subscription document
  const subscriptionDoc = await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .get();

  if (subscriptionDoc.exists) {
    const userId = subscriptionDoc.data()?.userId;

    if (userId) {
      // Update subscription status to past_due
      await adminDb
        .collection("subscriptions")
        .doc(subscriptionId)
        .update({
          status: "past_due",
          updatedAt: FieldValue.serverTimestamp(),
        });

      // Update user document with past_due status
      await adminDb
        .collection("users")
        .doc(userId)
        .update({
          subscriptionStatus: "past_due",
          updatedAt: FieldValue.serverTimestamp(),
        });

      console.log(`Payment failed for user ${userId}, status set to past_due`);
    }
  }
}
