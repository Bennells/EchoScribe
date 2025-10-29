import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "./config";
import type { Subscription } from "@/types/subscription";

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const subscriptionsRef = collection(db, "subscriptions");

  // Query for active subscriptions (includes canceled but still active until period end)
  const q = query(
    subscriptionsRef,
    where("userId", "==", userId),
    where("status", "==", "active")
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  // Get all active subscriptions and sort by currentPeriodEnd (most recent first)
  const subscriptions = snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Subscription))
    .sort((a, b) => {
      const aTime = a.currentPeriodEnd?.seconds || 0;
      const bTime = b.currentPeriodEnd?.seconds || 0;
      return bTime - aTime; // Descending order
    });

  // Return the most recent active subscription
  return subscriptions[0] || null;
}
