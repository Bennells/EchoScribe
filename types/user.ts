import { Timestamp } from "firebase/firestore";

export type UserTier = "free" | "starter" | "professional" | "business";

export interface User {
  id: string;
  email: string;
  createdAt: Timestamp;
  subscriptionStatus: "free" | "active" | "cancelled" | "past_due";
  tier?: UserTier;
  subscriptionId?: string;
  stripeCustomerId?: string;
  quota: {
    monthly: number;
    used: number;
    resetAt: Timestamp;
  };
}
