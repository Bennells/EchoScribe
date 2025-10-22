import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";
import type { User } from "@/types/user";

export async function checkQuota(userId: string): Promise<boolean> {
  const userDoc = await getDoc(doc(db, "users", userId));

  if (!userDoc.exists()) {
    throw new Error("User document not found");
  }

  const userData = userDoc.data() as User;
  const quota = userData.quota;

  // Check if quota needs reset (new month)
  const now = new Date();
  const resetDate = quota.resetAt.toDate();

  if (now >= resetDate) {
    // Reset quota
    await resetQuota(userId);
    return true;
  }

  // Check if user has quota left
  return quota.used < quota.monthly;
}

export async function incrementQuota(userId: string): Promise<void> {
  const userRef = doc(db, "users", userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    throw new Error("User document not found");
  }

  const userData = userDoc.data() as User;
  const newUsed = userData.quota.used + 1;

  await updateDoc(userRef, {
    "quota.used": newUsed,
  });
}

export async function resetQuota(userId: string): Promise<void> {
  const userRef = doc(db, "users", userId);

  // Calculate next reset date (1st of next month)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  await updateDoc(userRef, {
    "quota.used": 0,
    "quota.resetAt": Timestamp.fromDate(nextMonth),
  });
}

export async function getQuotaInfo(userId: string) {
  const userDoc = await getDoc(doc(db, "users", userId));

  if (!userDoc.exists()) {
    throw new Error("User document not found");
  }

  const userData = userDoc.data() as User;
  return {
    used: userData.quota.used,
    monthly: userData.quota.monthly,
    remaining: userData.quota.monthly - userData.quota.used,
    resetAt: userData.quota.resetAt.toDate(),
    hasQuota: userData.quota.used < userData.quota.monthly,
  };
}
