import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./config";
import type { User } from "@/types/user";

export async function checkQuota(userId: string): Promise<boolean> {
  const userDoc = await getDoc(doc(db, "users", userId));

  if (!userDoc.exists()) {
    throw new Error("User document not found");
  }

  const userData = userDoc.data() as User;
  const quota = userData.quota;

  // Pro users (active subscription) have unlimited quota
  if (userData.subscriptionStatus === "active") {
    return true;
  }

  // Free users have 3 uploads total (lifetime limit, no reset)
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

  // Pro users have unlimited quota
  const isPro = userData.subscriptionStatus === "active";
  const total = isPro ? Infinity : userData.quota.monthly; // Using 'monthly' field as total limit
  const remaining = isPro ? Infinity : userData.quota.monthly - userData.quota.used;

  return {
    used: userData.quota.used,
    total: total, // Changed from 'monthly' to 'total'
    remaining: remaining,
    hasQuota: isPro || userData.quota.used < userData.quota.monthly,
    isPro: isPro,
    subscriptionStatus: userData.subscriptionStatus,
  };
}
