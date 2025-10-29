"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getQuotaInfo } from "@/lib/firebase/quota";
import { getActiveSubscription } from "@/lib/firebase/subscription";
import toast from "react-hot-toast";
import { Database, AlertCircle } from "lucide-react";
import { DeleteAccountDialog } from "@/components/features/delete-account-dialog";
import { CancelSubscriptionDialog } from "@/components/features/subscription/cancel-subscription-dialog";
import { ReactivateSubscriptionDialog } from "@/components/features/subscription/reactivate-subscription-dialog";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useRouter } from "next/navigation";
import type { Subscription } from "@/types/subscription";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadQuotaInfo();
      loadSubscription();
    }
  }, [user]);

  const loadQuotaInfo = async () => {
    if (!user) return;
    try {
      const info = await getQuotaInfo(user.uid);
      setQuotaInfo(info);
    } catch (error) {
      console.error("Error loading quota info:", error);
    }
  };

  const loadSubscription = async () => {
    if (!user) return;
    try {
      const sub = await getActiveSubscription(user.uid);
      setSubscription(sub);
    } catch (error) {
      console.error("Error loading subscription:", error);
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Erstellen der Checkout-Session");
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error("Fehler beim Upgrade. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  };

  const isPro = quotaInfo?.isPro;
  const subscriptionStatus = quotaInfo?.subscriptionStatus;

  // Helper functions for date calculations and pricing
  const calculateDaysUntil = (date: Date): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriceForTier = (tier: string): string => {
    switch (tier) {
      case "starter":
        return "€9,99";
      case "professional":
        return "€24,99";
      case "business":
        return "€49,99";
      default:
        return "€0,00";
    }
  };

  const formatRenewalDate = (date: Date): string => {
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Kündigen des Abonnements");
      }

      toast.success("Abonnement erfolgreich gekündigt");

      // Reload subscription to get updated status
      await loadSubscription();
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      toast.error(error.message || "Fehler beim Kündigen des Abonnements. Bitte versuchen Sie es erneut.");
      throw error; // Re-throw to keep dialog loading state
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setReactivateLoading(true);
    try {
      const response = await fetch("/api/stripe/reactivate-subscription", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Reaktivieren des Abonnements");
      }

      toast.success("Abonnement erfolgreich reaktiviert");

      // Reload subscription to get updated status
      await loadSubscription();
    } catch (error: any) {
      console.error("Reactivate subscription error:", error);
      toast.error(error.message || "Fehler beim Reaktivieren des Abonnements. Bitte versuchen Sie es erneut.");
      throw error; // Re-throw to keep dialog loading state
    } finally {
      setReactivateLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const functions = getFunctions();
      const deleteUserAccount = httpsCallable(functions, "deleteUserAccount");

      toast.loading("Konto wird gelöscht...", { id: "delete-account" });

      await deleteUserAccount();

      toast.success("Konto erfolgreich gelöscht", { id: "delete-account" });

      // Sign out and redirect to homepage
      await signOut();
      router.push("/");
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast.error(
        "Fehler beim Löschen des Kontos. Bitte versuchen Sie es erneut.",
        { id: "delete-account" }
      );
      throw error; // Re-throw to keep dialog loading state
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground mt-2">
          Verwalten Sie Ihr Konto und Ihre Einstellungen
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
          <CardDescription>Ihre Kontoinformationen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">E-Mail</label>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Konto-Typ</label>
            <p className="text-sm text-muted-foreground">
              {quotaInfo?.tier === "free" && "Free Tier (3 Podcasts insgesamt)"}
              {quotaInfo?.tier === "starter" && "Starter (15 Podcasts pro Monat)"}
              {quotaInfo?.tier === "professional" && "Professional (60 Podcasts pro Monat)"}
              {quotaInfo?.tier === "business" && "Business (150 Podcasts pro Monat)"}
              {!quotaInfo?.tier && "Free Tier (3 Podcasts insgesamt)"}
            </p>
          </div>
          {quotaInfo && (
            <div>
              <label className="text-sm font-medium">Quota-Nutzung</label>
              <p className="text-sm text-muted-foreground">
                {quotaInfo.used} / {quotaInfo.total} Podcasts verwendet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datenschutz & DSGVO</CardTitle>
          <CardDescription>
            Einsicht und Export Ihrer gespeicherten Daten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Gemäß DSGVO Art. 15 haben Sie das Recht auf Auskunft über alle Ihre
            gespeicherten Daten. Sie können Ihre Daten jederzeit einsehen und exportieren.
          </p>
          <Button variant="outline" asChild>
            <a href="/dashboard/settings/my-data">
              <Database className="mr-2 h-4 w-4" />
              Meine Daten anzeigen
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abo-Verwaltung</CardTitle>
          <CardDescription>
            {quotaInfo?.tier && quotaInfo.tier !== "free"
              ? "Verwalten Sie Ihr aktives Abonnement"
              : "Wählen Sie einen Plan und starten Sie mit mehr Podcast-Analysen"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!quotaInfo?.tier || quotaInfo.tier === "free" ? (
            <>
              <div className="mb-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Wählen Sie aus unseren verschiedenen Plänen:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Starter: 15 Podcasts pro Monat (€9,99)</li>
                  <li>Professional: 60 Podcasts pro Monat (€24,99)</li>
                  <li>Business: 150 Podcasts pro Monat (€49,99)</li>
                </ul>
              </div>
              <Button asChild>
                <a href="/dashboard/pricing">
                  Pläne ansehen & upgraden
                </a>
              </Button>
            </>
          ) : (
            <>
              {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd ? (
                <div className="mb-4 p-4 bg-muted/50 border-l-4 border-l-primary rounded-md">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Ihr Abonnement wurde gekündigt
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Ihr Zugang bleibt bis zum{" "}
                        <span className="font-medium text-foreground">
                          {formatRenewalDate(new Date(subscription.currentPeriodEnd.seconds * 1000))}
                        </span>{" "}
                        aktiv
                        {(() => {
                          const daysLeft = calculateDaysUntil(new Date(subscription.currentPeriodEnd.seconds * 1000));
                          if (daysLeft > 0) {
                            return ` (noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"})`;
                          }
                          return "";
                        })()}
                        . Danach werden Sie auf den kostenlosen Plan herabgestuft.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sie haben ein aktives Abonnement. Vielen Dank für Ihre Unterstützung!
                  </p>
                  {subscription?.currentPeriodEnd && quotaInfo?.tier && (
                    <div className="mb-4 p-3 bg-muted/50 border border-border rounded-md">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            Nächste Verlängerung
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {getPriceForTier(quotaInfo.tier)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatRenewalDate(new Date(subscription.currentPeriodEnd.seconds * 1000))}
                          {(() => {
                            const daysUntil = calculateDaysUntil(new Date(subscription.currentPeriodEnd.seconds * 1000));
                            if (daysUntil > 0) {
                              return ` (in ${daysUntil} ${daysUntil === 1 ? "Tag" : "Tagen"})`;
                            } else if (daysUntil === 0) {
                              return " (heute)";
                            }
                            return "";
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-3">
                {subscription?.cancelAtPeriodEnd ? (
                  <ReactivateSubscriptionDialog
                    currentTier={quotaInfo.tier}
                    periodEndDate={new Date(subscription.currentPeriodEnd.seconds * 1000)}
                    onConfirm={handleReactivateSubscription}
                  />
                ) : (
                  <CancelSubscriptionDialog
                    currentTier={quotaInfo.tier}
                    periodEndDate={subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd.seconds * 1000) : new Date()}
                    onConfirm={handleCancelSubscription}
                  />
                )}
                <Button variant="outline" asChild>
                  <a href="/dashboard/pricing">
                    Andere Pläne ansehen
                  </a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Konto löschen</CardTitle>
          <CardDescription>
            Löschen Sie Ihr Konto und alle zugehörigen Daten permanent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog
            userEmail={user?.email || ""}
            onConfirm={handleDeleteAccount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
