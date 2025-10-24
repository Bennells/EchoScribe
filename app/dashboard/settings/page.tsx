"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getQuotaInfo } from "@/lib/firebase/quota";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { DeleteAccountDialog } from "@/components/features/delete-account-dialog";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
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

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Öffnen des Kundenportals");
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      toast.error("Fehler beim Öffnen des Kundenportals. Bitte versuchen Sie es erneut.");
    } finally {
      setPortalLoading(false);
    }
  };

  const isPro = quotaInfo?.isPro;
  const subscriptionStatus = quotaInfo?.subscriptionStatus;

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
              {isPro ? "Pro (Unbegrenzt)" : "Free Tier (3 Podcasts insgesamt)"}
            </p>
          </div>
          {quotaInfo && (
            <div>
              <label className="text-sm font-medium">Quota-Nutzung</label>
              <p className="text-sm text-muted-foreground">
                {quotaInfo.used} / {isPro ? "∞" : quotaInfo.total} Podcasts verwendet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abo-Verwaltung</CardTitle>
          <CardDescription>
            {isPro
              ? "Verwalten Sie Ihr aktives Abonnement"
              : "Wählen Sie einen Plan und starten Sie mit mehr Podcast-Analysen"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isPro ? (
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
              <p className="text-sm text-muted-foreground mb-4">
                Sie haben ein aktives Abonnement. Vielen Dank für Ihre Unterstützung!
              </p>
              <div className="flex gap-3">
                <Button onClick={handleManageSubscription} disabled={portalLoading}>
                  {portalLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wird geladen...
                    </>
                  ) : (
                    "Abonnement verwalten"
                  )}
                </Button>
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
