import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
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
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  console.log("Checkout session completed:", session.id);

  const userId = session.metadata?.userId;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId || !subscriptionId) {
    console.error("Missing userId or subscriptionId in session metadata");
    return;
  }

  // Retrieve the subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Create subscription document in Firestore
  const subscriptionData = {
    userId: userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: subscription.status,
    priceId: subscription.items.data[0].price.id,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .set(subscriptionData);

  console.log("Subscription created in Firestore:", subscriptionId);

  // Update user document to reflect subscription
  await adminDb
    .collection("users")
    .doc(userId)
    .update({
      subscriptionStatus: subscription.status,
      updatedAt: FieldValue.serverTimestamp(),
    });

  console.log("User subscription status updated:", userId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("Subscription updated:", subscription.id);

  const subscriptionId = subscription.id;

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

  // Get userId from subscription document
  const subscriptionDoc = await adminDb
    .collection("subscriptions")
    .doc(subscriptionId)
    .get();

  if (subscriptionDoc.exists) {
    const userId = subscriptionDoc.data()?.userId;

    if (userId) {
      // Update user document
      await adminDb
        .collection("users")
        .doc(userId)
        .update({
          subscriptionStatus: subscription.status,
          updatedAt: FieldValue.serverTimestamp(),
        });

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
      // Update user document to remove subscription
      await adminDb
        .collection("users")
        .doc(userId)
        .update({
          subscriptionStatus: "canceled",
          updatedAt: FieldValue.serverTimestamp(),
        });

      console.log("User subscription canceled:", userId);
    }
  }
}
