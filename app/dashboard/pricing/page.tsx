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
      toast.error("Fehler beim Laden der Quota-Informationen");
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
      toast.error("Sie können nicht zum Free-Plan downgraden. Bitte kündigen Sie Ihr Abo in den Einstellungen.");
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
          throw new Error(errorData.error || "Fehler beim Ändern des Plans");
        }

        const result = await response.json();
        toast.success("Plan erfolgreich geändert!");

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
          throw new Error("Fehler beim Erstellen der Checkout-Session");
        }

        const { url } = await response.json();

        if (url) {
          window.location.href = url;
        }
      }
    } catch (error: any) {
      console.error("Tier selection error:", error);
      toast.error(error.message || "Fehler beim Ändern des Plans. Bitte versuchen Sie es erneut.");
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
        <h1 className="text-3xl font-bold">Preise & Pläne</h1>
        <p className="text-muted-foreground mt-2">
          Wählen Sie den Plan, der am besten zu Ihren Bedürfnissen passt
        </p>
      </div>

      {/* Launch Special Banner */}
      {LAUNCH_SPECIAL_MODE && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Launch Special Phase</p>
            <p>
              Aktuell ist nur der kostenlose Plan mit 200 Minuten verfügbar. Weitere Preisstufen (Starter, Professional, Business) folgen in Kürze.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Info */}
      {quotaInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Ihr aktueller Plan</CardTitle>
            <CardDescription>
              {currentTier === "free" && "Sie nutzen derzeit den kostenlosen Plan"}
              {currentTier === "starter" && "Sie nutzen derzeit den Starter Plan"}
              {currentTier === "professional" && "Sie nutzen derzeit den Professional Plan"}
              {currentTier === "business" && "Sie nutzen derzeit den Business Plan"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Quota-Nutzung: </span>
                <span className="text-sm text-muted-foreground">
                  {quotaInfo.used} / {quotaInfo.total} Minuten verwendet
                </span>
              </div>
              {isPro && quotaInfo.subscriptionStatus === "active" && (
                <div>
                  <span className="text-sm font-medium">Status: </span>
                  <span className="text-sm text-green-600">Aktiv</span>
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
          <CardTitle>Plan-Verwaltung</CardTitle>
          <CardDescription>
            Informationen zu Ihrem Abonnement und wie Sie es verwalten können
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Wie funktioniert ein Upgrade?</h3>
            <p className="text-sm text-muted-foreground">
              Wenn Sie einen höheren Plan wählen, erhalten Sie sofort Zugriff auf die erweiterte Quota.
              Die Abrechnung erfolgt anteilig für den verbleibenden Monat.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Wie kann ich meinen Plan kündigen?</h3>
            <p className="text-sm text-muted-foreground">
              Gehen Sie zu den <a href="/dashboard/settings" className="text-primary hover:underline">Einstellungen</a> und
              klicken Sie auf &quot;Abonnement verwalten&quot;. Sie werden zum Stripe-Kundenportal weitergeleitet,
              wo Sie Ihr Abonnement kündigen können.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Was passiert nach der Kündigung?</h3>
            <p className="text-sm text-muted-foreground">
              Ihr Abonnement bleibt bis zum Ende des bezahlten Zeitraums aktiv.
              Danach werden Sie automatisch auf den Free-Plan herabgestuft.
              Ihre Daten und bereits erstellten Artikel bleiben erhalten.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
