import type { UserTier } from "@/types/user";

// Launch Special Mode: Only free tier available with 200 minutes
export const LAUNCH_SPECIAL_MODE = true;

export const TIER_LIMITS: Record<UserTier, number> = {
  free: LAUNCH_SPECIAL_MODE ? 200 : 100, // Launch Special: 200 minutes, normally 100 minutes per month
  starter: 240, // 240 minutes per month
  professional: 600, // 600 minutes per month
  business: 2000, // 2000 minutes per month
};

export const TIER_PRICES: Record<UserTier, number> = {
  free: 0,
  starter: 19,
  professional: 49,
  business: 149,
};

export function getTierLimit(tier: UserTier): number {
  return TIER_LIMITS[tier];
}

export function getTierPrice(tier: UserTier): number {
  return TIER_PRICES[tier];
}
