import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";
import { TIER_LIMITS } from "@/lib/constants/pricing";

/**
 * Create user document in Firestore after successful registration
 * Called client-side after Firebase Auth user is created
 */
export async function createUserDocument(userId: string, email: string): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);

    // Calculate resetAt (first day of next month)
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const userData = {
      email,
      createdAt: Timestamp.now(),
      subscriptionStatus: "free",
      quota: {
        monthly: TIER_LIMITS.free, // Free tier: 100 minutes per month
        used: 0,
        resetAt: Timestamp.fromDate(resetDate),
      },
    };

    await setDoc(userRef, userData);
  } catch (error: any) {
    console.error("[createUserDocument] Error creating user document:", {
      userId,
      email,
      error: error.message,
      errorCode: error.code,
    });
    throw error; // Re-throw to let caller handle it
  }
}
