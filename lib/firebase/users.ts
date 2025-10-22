import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";

/**
 * Create user document in Firestore after successful registration
 * Called client-side after Firebase Auth user is created
 */
export async function createUserDocument(userId: string, email: string): Promise<void> {
  // Calculate first quota reset date (1st of next month)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  await setDoc(doc(db, "users", userId), {
    email,
    createdAt: Timestamp.now(),
    subscriptionStatus: "free",
    quota: {
      monthly: 3, // Free tier: 3 podcasts/month
      used: 0,
      resetAt: Timestamp.fromDate(nextMonth),
    },
  });
}
