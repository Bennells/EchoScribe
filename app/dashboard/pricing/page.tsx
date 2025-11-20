"use client";

import { PricingCards, PricingTier } from "@/components/features/pricing/pricing-cards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangeTierDialog } from "@/components/features/subscription/change-tier-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/auth-context";
import { useState, useEffect, useRef } from "react";
import { getQuotaInfo } from "@/lib/firebase/quota";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
import { LAUNCH_SPECIAL_MODE } from "@/lib/constants/pricing";

export default function DashboardPricingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingTier, setLoadingTier] = useState<PricingTier | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);
  const [showChangeTierDialog, setShowChangeTierDialog] = useState(false);
  const [pendingTierChange, setPendingTierChange] = useState<PricingTier | null>(null);
  const dialogTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (user) {
      loadQuotaInfo();
    }
  }, [user]);

  // Trigger dialog when pendingTierChange is set
  useEffect(() => {
    if (pendingTierChange && dialogTriggerRef.current) {
      dialogTriggerRef.current.click();
    }
  }, [pendingTierChange]);

  const loadQuotaInfo = async () => {
    if (!user) return;
    try {
      const info = await getQuotaInfo(user.uid);
      setQuotaInfo(info);
    } catch (error) {
      console.error("Error loading quota info:", error);
      toast.error("Error loading quota information");
      // Set default quota info on error
      setQuotaInfo({
        used: 0,
        total: 3,
        remaining: 3,
        hasQuota: true,
        isPro: false,
        tier: "free",
        subscriptionStatus: "free",
      });
    }
  };

  const getCurrentTier = (): PricingTier => {
    if (!quotaInfo) return "free";

    // If user has a tier field, use that
    if (quotaInfo.tier) {
      return quotaInfo.tier as PricingTier;
    }

    // Legacy: determine tier by isPro status
    if (quotaInfo.isPro) {
      // Default Pro users to Professional tier
      return "professional";
    }

    return "free";
  };

  const currentTier = getCurrentTier();

  const handleSelectTier = async (tier: PricingTier) => {
    if (tier === "free") {
      toast.error("You cannot downgrade to the Free plan. Please cancel your subscription in Settings.");
      return;
    }

    // Check if user has an active subscription
    const hasActiveSubscription = quotaInfo?.subscriptionStatus === "active" && currentTier !== "free";

    if (hasActiveSubscription) {
      // Show confirmation dialog for plan changes
      setPendingTierChange(tier);
    } else {
      // No active subscription - proceed directly to checkout
      await executeTierChange(tier);
    }
  };

  const executeTierChange = async (tier: PricingTier) => {
    setLoading(true);
    setLoadingTier(tier);

    try {
      // Check if user has an active subscription
      const hasActiveSubscription = quotaInfo?.subscriptionStatus === "active" && currentTier !== "free";

      if (hasActiveSubscription) {
        // User has active subscription - use change-plan API
        const response = await fetch("/api/stripe/change-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tier }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error changing plan");
        }

        const result = await response.json();
        toast.success("Plan successfully changed!");

        // Reload quota info to reflect new tier
        await loadQuotaInfo();
      } else {
        // User doesn't have active subscription - create new checkout session
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tier }),
        });

        if (!response.ok) {
          throw new Error("Error creating checkout session");
        }

        const { url } = await response.json();

        if (url) {
          window.location.href = url;
        }
      }
    } catch (error: any) {
      console.error("Tier selection error:", error);
      toast.error(error.message || "Error changing plan. Please try again.");
    } finally {
      setLoading(false);
      setLoadingTier(null);
      setPendingTierChange(null);
    }
  };

  const isPro = quotaInfo?.isPro;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Pricing & Plans</h1>
        <p className="text-muted-foreground mt-2">
          Choose the plan that best fits your needs
        </p>
      </div>

      {/* Launch Special Banner */}
      {LAUNCH_SPECIAL_MODE && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Launch Special Phase</p>
            <p>
              Currently only the free plan with 200 minutes is available. Additional pricing tiers (Starter, Professional, Business) coming soon.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Info */}
      {quotaInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Your Current Plan</CardTitle>
            <CardDescription>
              {currentTier === "free" && "You are currently using the free plan"}
              {currentTier === "starter" && "You are currently using the Starter plan"}
              {currentTier === "professional" && "You are currently using the Professional plan"}
              {currentTier === "business" && "You are currently using the Business plan"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Quota Usage: </span>
                <span className="text-sm text-muted-foreground">
                  {quotaInfo.used} / {quotaInfo.total} minutes used
                </span>
              </div>
              {isPro && quotaInfo.subscriptionStatus === "active" && (
                <div>
                  <span className="text-sm font-medium">Status: </span>
                  <span className="text-sm text-green-600">Active</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Cards */}
      <div>
        <PricingCards
          currentTier={currentTier}
          onSelectTier={handleSelectTier}
          isAuthenticated={true}
          loading={loading}
          loadingTier={loadingTier}
        />
      </div>

      {/* Hidden dialog trigger and dialog */}
      {pendingTierChange && currentTier !== "free" && (
        <ChangeTierDialog
          currentTier={currentTier as "starter" | "professional" | "business"}
          newTier={pendingTierChange as "starter" | "professional" | "business"}
          onConfirm={async () => {
            await executeTierChange(pendingTierChange);
          }}
        >
          <Button ref={dialogTriggerRef} style={{ display: "none" }}>
            Hidden Trigger
          </Button>
        </ChangeTierDialog>
      )}

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Management</CardTitle>
          <CardDescription>
            Information about your subscription and how to manage it
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">How does upgrading work?</h3>
            <p className="text-sm text-muted-foreground">
              When you choose a higher plan, you get immediate access to the expanded quota.
              Billing is prorated for the remaining month.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">How can I cancel my plan?</h3>
            <p className="text-sm text-muted-foreground">
              Go to <a href="/dashboard/settings" className="text-primary hover:underline">Settings</a> and
              click &quot;Manage Subscription&quot;. You will be redirected to the Stripe customer portal
              where you can cancel your subscription.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">What happens after cancellation?</h3>
            <p className="text-sm text-muted-foreground">
              Your subscription remains active until the end of the paid period.
              After that, you will automatically be downgraded to the Free plan.
              Your data and already created articles will be preserved.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
