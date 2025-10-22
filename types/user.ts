import { Timestamp } from "firebase/firestore";

export interface User {
  id: string;
  email: string;
  createdAt: Timestamp;
  subscriptionStatus: "free" | "active" | "cancelled" | "past_due";
  subscriptionId?: string;
  stripeCustomerId?: string;
  quota: {
    monthly: number;
    used: number;
    resetAt: Timestamp;
  };
}
