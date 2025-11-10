import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Safely refund quota to a user, preventing negative values
 *
 * Uses a transaction to ensure atomicity and prevent race conditions.
 * The quota will never go below 0, even if multiple refunds happen simultaneously.
 *
 * @param userId - The user's Firestore document ID
 * @param amount - The amount of quota (in minutes) to refund
 * @param reason - Optional reason for the refund (for logging)
 */
export async function safeRefundQuota(
  userId: string,
  amount: number,
  reason?: string
): Promise<void> {
  if (amount <= 0) {
    logger.warn(`[QuotaRefund] Invalid refund amount: ${amount} (must be > 0)`);
    return;
  }

  try {
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        logger.error(`[QuotaRefund] User document not found: ${userId}`);
        throw new Error(`User document not found: ${userId}`);
      }

      const userData = userDoc.data()!;
      const currentUsed = userData.quota?.used || 0;
      const monthlyLimit = userData.quota?.monthly || 0;

      // Calculate new quota, ensuring it never goes negative
      const newUsed = Math.max(0, currentUsed - amount);

      logger.info(`[QuotaRefund] Refunding quota for user ${userId}`, {
        reason: reason || "unspecified",
        currentUsed,
        monthlyLimit,
        refundAmount: amount,
        newUsed,
        actualRefunded: currentUsed - newUsed,
      });

      // Update quota atomically
      transaction.update(userRef, {
        "quota.used": newUsed,
      });
    });

    logger.info(`[QuotaRefund] ✅ Successfully refunded ${amount} minutes for user ${userId}`);
  } catch (error: any) {
    logger.error(`[QuotaRefund] ❌ Failed to refund quota for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      amount,
      reason,
    });
    throw error;
  }
}

/**
 * Reserve quota for a user atomically
 *
 * This should only be called from onPodcastUploaded trigger.
 * Use this instead of direct FieldValue.increment to have better visibility.
 *
 * @param userId - The user's Firestore document ID
 * @param amount - The amount of quota (in minutes) to reserve
 * @returns true if quota was reserved, false if quota exceeded
 */
export async function reserveQuota(
  userId: string,
  amount: number
): Promise<boolean> {
  if (amount <= 0) {
    logger.warn(`[QuotaReserve] Invalid reserve amount: ${amount} (must be > 0)`);
    return false;
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        logger.error(`[QuotaReserve] User document not found: ${userId}`);
        throw new Error(`User document not found: ${userId}`);
      }

      const userData = userDoc.data()!;
      const currentUsed = userData.quota?.used || 0;
      const monthlyLimit = userData.quota?.monthly || 0;
      const newUsed = currentUsed + amount;

      logger.info(`[QuotaReserve] Attempting to reserve quota for user ${userId}`, {
        currentUsed,
        monthlyLimit,
        reserveAmount: amount,
        newUsed,
        available: monthlyLimit - currentUsed,
      });

      // Check if quota would be exceeded
      if (newUsed > monthlyLimit) {
        logger.warn(`[QuotaReserve] ⚠️ Quota exceeded for user ${userId}`, {
          currentUsed,
          monthlyLimit,
          requested: amount,
          wouldBe: newUsed,
          shortfall: newUsed - monthlyLimit,
        });
        return false;
      }

      // Reserve quota atomically
      transaction.update(userRef, {
        "quota.used": newUsed,
      });

      return true;
    });

    if (result) {
      logger.info(`[QuotaReserve] ✅ Successfully reserved ${amount} minutes for user ${userId}`);
    }

    return result;
  } catch (error: any) {
    logger.error(`[QuotaReserve] ❌ Failed to reserve quota for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      amount,
    });
    throw error;
  }
}
