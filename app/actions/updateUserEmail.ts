"use server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export interface UpdateEmailResult {
  success: boolean;
  error?: string;
  errorCode?:
    | "unauthorized"
    | "invalid-email"
    | "email-in-use"
    | "stripe-update-failed"
    | "firestore-update-failed"
    | "unknown";
}

/**
 * Updates user email across Firestore and Stripe (if customer exists).
 * Firebase Auth email must be updated separately on the client side using verifyBeforeUpdateEmail.
 * This function should be called AFTER the user has verified their new email address.
 */
export async function updateUserEmail(
  userId: string,
  newEmail: string,
  idToken: string
): Promise<UpdateEmailResult> {
  try {
    // 1. Verify the user is authenticated and the token is valid
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error("Invalid ID token:", error);
      return {
        success: false,
        error: "Unauthorized. Please sign in again.",
        errorCode: "unauthorized",
      };
    }

    // Ensure the token belongs to the user trying to update
    if (decodedToken.uid !== userId) {
      return {
        success: false,
        error: "Unauthorized. Token mismatch.",
        errorCode: "unauthorized",
      };
    }

    // 2. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return {
        success: false,
        error: "Invalid email format.",
        errorCode: "invalid-email",
      };
    }

    // 3. Get user document to check for Stripe customer
    const userDocRef = adminDb.collection("users").doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return {
        success: false,
        error: "User document not found.",
        errorCode: "unknown",
      };
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData?.stripeCustomerId;

    // 4. Update Stripe customer email if customer exists
    if (stripeCustomerId) {
      try {
        await stripe.customers.update(stripeCustomerId, {
          email: newEmail,
        });
        console.log(
          `Successfully updated Stripe customer ${stripeCustomerId} email to ${newEmail}`
        );
      } catch (stripeError: any) {
        console.error("Failed to update Stripe customer email:", stripeError);

        // Don't fail the entire operation if Stripe update fails
        // We'll log it and continue to update Firestore
        // The email can be manually synced later if needed
        console.warn(
          `Stripe update failed but continuing with Firestore update. Error: ${stripeError.message}`
        );
      }
    }

    // 5. Update Firestore user document
    try {
      await userDocRef.update({
        email: newEmail,
        emailUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Successfully updated Firestore user ${userId} email to ${newEmail}`);
    } catch (firestoreError: any) {
      console.error("Failed to update Firestore user email:", firestoreError);

      // If Firestore update fails, try to rollback Stripe if it was updated
      if (stripeCustomerId && userData?.email) {
        try {
          await stripe.customers.update(stripeCustomerId, {
            email: userData.email,
          });
          console.log("Rolled back Stripe customer email update");
        } catch (rollbackError) {
          console.error("Failed to rollback Stripe update:", rollbackError);
        }
      }

      return {
        success: false,
        error: "Failed to update user data. Please try again.",
        errorCode: "firestore-update-failed",
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Unexpected error in updateUserEmail:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
      errorCode: "unknown",
    };
  }
}
