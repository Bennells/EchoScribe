import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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

      case "invoice.payment_succeeded": {
        console.log("Processing invoice.payment_succeeded event");
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "invoice.paid": {
        console.log("Processing invoice.paid event");
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
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

  // Retrieve the subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Map tier to quota limits
  const quotaLimits: Record<string, number> = {
    starter: 15,
    professional: 60,
    business: 150,
    pro: 60, // Legacy support
  };

  const monthlyQuota = quotaLimits[tier] || 60;

  // Create subscription document in Firestore
  const subscriptionData = {
    userId: userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: subscription.status,
    priceId: subscription.items.data[0].price.id,
    tier: tier,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

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
    await adminDb
      .collection("users")
      .doc(userId)
      .update({
        subscriptionStatus: subscription.status,
        tier: tier,
        "quota.monthly": monthlyQuota,
        "quota.used": 0, // Reset usage when new subscription starts
        "quota.resetAt": new Date(subscription.current_period_end * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });

    console.log("✅ User subscription status and tier updated:", userId, tier);
  } catch (error) {
    console.error("❌ ERROR updating user in Firestore:", error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log("=== INVOICE PAYMENT SUCCEEDED ===");
  console.log("Invoice ID:", invoice.id);
  console.log("Invoice subscription:", invoice.subscription);
  console.log("Invoice customer:", invoice.customer);
  console.log("Invoice metadata:", invoice.metadata);
  console.log("Full invoice object:", JSON.stringify(invoice, null, 2));

  // Try to get subscription ID from multiple possible locations
  let subscriptionId = invoice.subscription as string;

  // If not found at top level, try nested in parent.subscription_details
  if (!subscriptionId && (invoice as any).parent?.subscription_details?.subscription) {
    subscriptionId = (invoice as any).parent.subscription_details.subscription;
    console.log("Found subscription ID in parent.subscription_details:", subscriptionId);
  }

  // If still not found, try to get from line items
  if (!subscriptionId && invoice.lines?.data?.length > 0) {
    const lineItem = invoice.lines.data[0];
    if ((lineItem as any).parent?.subscription_item_details?.subscription) {
      subscriptionId = (lineItem as any).parent.subscription_item_details.subscription;
      console.log("Found subscription ID in line item:", subscriptionId);
    }
  }

  if (!subscriptionId) {
    console.log("No subscription ID in invoice. Attempting to find subscription by customer ID...");

    // Try to find the subscription by customer ID
    const customerId = invoice.customer as string;
    if (customerId) {
      console.log("Looking up subscriptions for customer:", customerId);

      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
          status: 'active',
        });

        if (subscriptions.data.length > 0) {
          const foundSubscription = subscriptions.data[0];
          console.log("Found active subscription:", foundSubscription.id);

          // Use the found subscription ID
          await processInvoicePayment(foundSubscription.id);
          return;
        } else {
          console.log("No active subscriptions found for customer");
        }
      } catch (error) {
        console.error("Error looking up subscriptions:", error);
      }
    }

    console.log("Cannot process invoice without subscription ID");
    return;
  }

  console.log("Subscription ID:", subscriptionId);
  await processInvoicePayment(subscriptionId);
}

async function processInvoicePayment(subscriptionId: string) {
  console.log("Processing invoice payment for subscription:", subscriptionId);

  // Get the subscription document to retrieve userId and tier
  const subscriptionDoc = await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .get();

  if (!subscriptionDoc.exists) {
    console.log("Subscription document doesn't exist yet, this might be the first payment. Waiting for checkout.session.completed to create it.");
    return;
  }

  const subscriptionData = subscriptionDoc.data();
  const userId = subscriptionData?.userId;
  const tier = subscriptionData?.tier || "professional";

  if (!userId) {
    console.error("ERROR: No userId found in subscription document");
    return;
  }

  console.log("User ID:", userId);
  console.log("Tier:", tier);

  // Retrieve the full subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Map tier to quota limits
  const quotaLimits: Record<string, number> = {
    starter: 15,
    professional: 60,
    business: 150,
    pro: 60, // Legacy support
  };

  const monthlyQuota = quotaLimits[tier] || 60;

  // Update subscription document with latest status
  console.log("Updating subscription document...");
  await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .update({
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: FieldValue.serverTimestamp(),
    });

  console.log("✅ Subscription updated in Firestore");

  // Update user document - ensure tier and quota are set correctly
  console.log("Updating user document with tier and quota...");
  try {
    await adminDb
      .collection("users")
      .doc(userId)
      .update({
        subscriptionStatus: subscription.status,
        tier: tier,
        "quota.monthly": monthlyQuota,
        "quota.resetAt": new Date(subscription.current_period_end * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });

    console.log("✅ User subscription status and tier updated after payment:", userId, tier);
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

  // Update subscription document in Firestore
  const subscriptionData = {
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .update(subscriptionData);

  if (subscriptionDoc.exists) {
    const userId = subscriptionDoc.data()?.userId;
    const tier = subscriptionDoc.data()?.tier || "professional";

    if (userId) {
      // Check if it's the start of a new billing period (quota reset)
      const userDoc = await adminDb.collection("users").doc(userId).get();
      const userData = userDoc.data();
      const previousPeriodEnd = userData?.quota?.resetAt?.toDate();
      const newPeriodEnd = new Date(subscription.current_period_end * 1000);

      const shouldResetQuota =
        !previousPeriodEnd ||
        newPeriodEnd.getTime() > previousPeriodEnd.getTime();

      // Update user document
      const userUpdate: any = {
        subscriptionStatus: subscription.status,
        "quota.resetAt": newPeriodEnd,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Reset quota if it's a new billing period
      if (shouldResetQuota) {
        userUpdate["quota.used"] = 0;
        console.log("Resetting quota for user:", userId);
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
      // Revert user to free tier
      await adminDb
        .collection("users")
        .doc(userId)
        .update({
          subscriptionStatus: "canceled",
          tier: "free",
          "quota.monthly": 3,
          "quota.used": 0,
          updatedAt: FieldValue.serverTimestamp(),
        });

      console.log("User subscription canceled and reverted to free tier:", userId);
    }
  }
}
