import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";

/**
 * Create user document in Firestore after successful registration
 * Called client-side after Firebase Auth user is created
 */
export async function createUserDocument(userId: string, email: string): Promise<void> {
  await setDoc(doc(db, "users", userId), {
    email,
    createdAt: Timestamp.now(),
    subscriptionStatus: "free",
    quota: {
      monthly: 3, // Free tier: 3 podcasts total (lifetime limit, no reset)
      used: 0,
    },
  });
}
