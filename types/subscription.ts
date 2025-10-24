import { Timestamp } from "firebase/firestore";
import { UserTier } from "./user";

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId: string;
  tier?: UserTier;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  cancelAtPeriodEnd: boolean;
}
