"use client";

import { PricingCards, PricingTier } from "@/components/features/pricing/pricing-cards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/firebase/auth-context";
import { useState, useEffect } from "react";
import { getQuotaInfo } from "@/lib/firebase/quota";
import toast from "react-hot-toast";

export default function DashboardPricingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingTier, setLoadingTier] = useState<PricingTier | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadQuotaInfo();
    }
  }, [user]);

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

  const handleSelectTier = async (tier: PricingTier) => {
    if (tier === "free") {
      toast.error("Sie können nicht zum Free-Plan downgraden. Bitte kündigen Sie Ihr Abo in den Einstellungen.");
      return;
    }

    setLoading(true);
    setLoadingTier(tier);

    try {
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
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error("Fehler beim Upgrade. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
      setLoadingTier(null);
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
  const isPro = quotaInfo?.isPro;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Preise & Pläne</h1>
        <p className="text-muted-foreground mt-2">
          Wählen Sie den Plan, der am besten zu Ihren Bedürfnissen passt
        </p>
      </div>

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
                  {quotaInfo.used} / {isPro ? quotaInfo.total : "3"} Podcasts verwendet
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
