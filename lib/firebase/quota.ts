import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./config";
import type { User } from "@/types/user";

export async function checkQuota(userId: string, minutesNeeded: number = 0): Promise<boolean> {
  const userDoc = await getDoc(doc(db, "users", userId));

  if (!userDoc.exists()) {
    throw new Error("User document not found");
  }

  const userData = userDoc.data() as User;
  const quota = userData.quota;

  // All tiers (free, starter, professional, business) have monthly limits in minutes
  // Check if user has enough quota remaining
  return (quota.used + minutesNeeded) <= quota.monthly;
}

export async function incrementQuota(userId: string, minutes: number): Promise<void> {
  const userRef = doc(db, "users", userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    throw new Error("User document not found");
  }

  const userData = userDoc.data() as User;
  const newUsed = userData.quota.used + minutes;

  await updateDoc(userRef, {
    "quota.used": newUsed,
  });
}

export async function resetQuota(_userId: string): Promise<void> {
  // This function is no longer used since we have lifetime quota
  // Kept for backward compatibility but does nothing
  console.warn("resetQuota called but quota no longer resets monthly");
}

export async function getQuotaInfo(userId: string) {
  const userDoc = await getDoc(doc(db, "users", userId));

  if (!userDoc.exists()) {
    throw new Error("User document not found");
  }

  const userData = userDoc.data() as User;

  // All paid tiers (starter, professional, business) have limited quotas
  // No tier has unlimited quota anymore
  const isPro = false; // Deprecated: all tiers now have limits
  const tier = userData.tier || "free";
  const total = userData.quota.monthly; // Using 'monthly' field for all tiers
  const remaining = userData.quota.monthly - userData.quota.used;

  return {
    used: userData.quota.used,
    total: total,
    remaining: remaining,
    hasQuota: userData.quota.used < userData.quota.monthly,
    isPro: isPro,
    tier: tier,
    subscriptionStatus: userData.subscriptionStatus,
  };
}
