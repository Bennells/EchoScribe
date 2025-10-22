import { Timestamp } from "firebase/firestore";

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId: string;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  cancelAtPeriodEnd: boolean;
}
