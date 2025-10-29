import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";

/**
 * Create user document in Firestore after successful registration
 * Called client-side after Firebase Auth user is created
 */
export async function createUserDocument(userId: string, email: string): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);
    const userData = {
      email,
      createdAt: Timestamp.now(),
      subscriptionStatus: "free",
      quota: {
        monthly: 3, // Free tier: 3 podcasts total (lifetime limit, no reset)
        used: 0,
        freeLifetimeUsed: 0, // Tracks lifetime free tier usage across subscription changes
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
