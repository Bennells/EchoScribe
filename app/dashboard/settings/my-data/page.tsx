"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUserDataClient, type UserDataExport } from "@/app/actions/getUserDataClient";
import { Loader2, Download, Database, FileAudio, FileText, CreditCard, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";

export default function MyDataPage() {
  const { user } = useAuth();
  const [data, setData] = useState<UserDataExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await getUserDataClient(user.uid);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        toast.error(result.error || "Fehler beim Laden der Daten");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!data) return;

    setExporting(true);
    try {
      // Create GDPR-compliant export from current data
      const gdprExport = {
        exportDate: new Date().toISOString(),
        exportVersion: "1.0",

        userData: data.user
          ? {
              email: data.user.email,
              accountCreated: data.user.createdAt?.toDate?.()?.toISOString() || "",
              tier: data.user.tier || "free",
              subscriptionStatus: data.user.subscriptionStatus,
              quota: {
                monthly: data.user.quota.monthly,
                used: data.user.quota.used,
                resetAt: data.user.quota.resetAt?.toDate?.()?.toISOString(),
              },
              stripeCustomerId: data.user.stripeCustomerId,
            }
          : null,

        podcasts: data.podcasts.map((podcast) => ({
          id: podcast.id,
          fileName: podcast.fileName,
          fileSize: podcast.fileSize,
          uploadedAt: podcast.uploadedAt?.toDate?.()?.toISOString() || "",
          status: podcast.status,
          storagePath: podcast.storagePath,
          downloadUrl: podcast.downloadUrl,
          duration: podcast.duration,
          processingStartedAt: podcast.processingStartedAt?.toDate?.()?.toISOString(),
          processingCompletedAt: podcast.processingCompletedAt?.toDate?.()?.toISOString(),
          errorMessage: podcast.errorMessage,
        })),

        articles: data.articles.map((article) => ({
          id: article.id,
          title: article.title,
          slug: article.slug,
          createdAt: article.createdAt?.toDate?.()?.toISOString() || "",
          editedAt: article.editedAt?.toDate?.()?.toISOString(),
          contentMarkdown: article.contentMarkdown,
          metaDescription: article.metaDescription,
          keywords: article.keywords,
        })),

        subscriptions: data.subscriptions.map((subscription) => ({
          id: subscription.id,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          status: subscription.status,
          tier: subscription.tier,
          currentPeriodStart: subscription.currentPeriodStart?.toDate?.()?.toISOString() || "",
          currentPeriodEnd: subscription.currentPeriodEnd?.toDate?.()?.toISOString() || "",
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        })),

        gdprInformation: {
          dataCategories: [
            {
              category: "Identifikationsdaten",
              description: "Daten zur Identifizierung Ihres Kontos",
              fields: ["E-Mail-Adresse", "Benutzer-ID", "Stripe-Kunden-ID"],
            },
            {
              category: "Kontodaten",
              description: "Informationen zu Ihrem Konto-Status",
              fields: ["Erstellungsdatum", "Abo-Tier", "Abo-Status", "Quota-Nutzung"],
            },
            {
              category: "Inhaltsdaten",
              description: "Von Ihnen hochgeladene und generierte Inhalte",
              fields: ["Podcast-Audiodateien", "Generierte Artikel", "Dateinamen", "Metadaten"],
            },
            {
              category: "Finanzdaten",
              description: "Zahlungsbezogene Informationen",
              fields: ["Abo-Informationen", "Abrechnungszeiträume", "Stripe-Referenzen"],
            },
          ],
          processingPurposes: [
            "Kontoverwaltung und Authentifizierung",
            "Service-Bereitstellung (Podcast-zu-Artikel-Konvertierung)",
            "Abrechnung und Abo-Verwaltung",
            "Service-Verbesserung und Fehleranalyse",
          ],
          thirdPartyRecipients: [
            {
              name: "Google Cloud Platform",
              purpose: "Hosting und AI-Verarbeitung",
              dataShared: ["Audiodateien", "Nutzerdaten", "Generierte Inhalte"],
            },
            {
              name: "Stripe Inc.",
              purpose: "Zahlungsabwicklung",
              dataShared: ["E-Mail-Adresse", "Stripe-Kunden-ID", "Abo-Informationen"],
            },
          ],
          retentionPolicy:
            "Alle Daten werden bis zur Kontolöschung gespeichert. Nach Kontolöschung werden alle Daten innerhalb von 30 Tagen vollständig gelöscht.",
          userRights: [
            "Recht auf Auskunft (Art. 15 DSGVO) - Diese Exportfunktion",
            "Recht auf Berichtigung (Art. 16 DSGVO) - Kontaktieren Sie support@echoscribe.de",
            "Recht auf Löschung (Art. 17 DSGVO) - Verfügbar in den Kontoeinstellungen",
            "Recht auf Datenportabilität (Art. 20 DSGVO) - Diese Exportfunktion",
          ],
        },
      };

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(gdprExport, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `echoscribe-daten-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Daten erfolgreich exportiert");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Fehler beim Exportieren der Daten");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.user) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Meine Daten</h1>
          <p className="text-muted-foreground mt-2">
            Ihre gespeicherten Daten konnten nicht geladen werden.
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meine Daten</h1>
          <p className="text-muted-foreground mt-2">
            Einsicht in alle Ihre gespeicherten Daten gemäß DSGVO Art. 15
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exportiere...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Als JSON exportieren
            </>
          )}
        </Button>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Profil-Informationen
          </CardTitle>
          <CardDescription>Ihre Konto- und Identifikationsdaten</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">E-Mail-Adresse</label>
              <p className="text-sm mt-1">{data.user.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Benutzer-ID</label>
              <p className="text-sm mt-1 font-mono text-xs">{data.user.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Konto erstellt</label>
              <p className="text-sm mt-1">{formatDate(data.user.createdAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Abo-Tier</label>
              <p className="text-sm mt-1 capitalize">{data.user.tier || "free"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Abo-Status</label>
              <p className="text-sm mt-1 capitalize">{data.user.subscriptionStatus}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Quota-Nutzung</label>
              <p className="text-sm mt-1">
                {data.user.quota.used} / {data.user.quota.monthly} verwendet
              </p>
            </div>
            {data.user.stripeCustomerId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Stripe-Kunden-ID</label>
                <p className="text-sm mt-1 font-mono text-xs">{data.user.stripeCustomerId}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Podcasts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Podcasts ({data.podcasts.length})
          </CardTitle>
          <CardDescription>Alle von Ihnen hochgeladenen Audio-Dateien</CardDescription>
        </CardHeader>
        <CardContent>
          {data.podcasts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Podcasts hochgeladen</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 font-medium">Dateiname</th>
                    <th className="text-left py-2 font-medium">Größe</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Hochgeladen</th>
                    <th className="text-left py-2 font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.podcasts.map((podcast) => (
                    <tr key={podcast.id} className="border-b">
                      <td className="py-3 max-w-xs truncate">{podcast.fileName}</td>
                      <td className="py-3">{formatBytes(podcast.fileSize)}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            podcast.status === "completed"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : podcast.status === "error"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }`}
                        >
                          {podcast.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(podcast.uploadedAt)}
                      </td>
                      <td className="py-3">
                        {podcast.downloadUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={podcast.downloadUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Articles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Artikel ({data.articles.length})
          </CardTitle>
          <CardDescription>Alle generierten Artikel aus Ihren Podcasts</CardDescription>
        </CardHeader>
        <CardContent>
          {data.articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Artikel generiert</p>
          ) : (
            <div className="space-y-3">
              {data.articles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{article.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Erstellt: {formatDate(article.createdAt)}
                    </p>
                    {article.metaDescription && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {article.metaDescription}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" asChild className="ml-4 shrink-0">
                    <Link href={`/dashboard/articles/${article.slug}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions */}
      {data.subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Abonnements ({data.subscriptions.length})
            </CardTitle>
            <CardDescription>Ihre Abo-Historie und Zahlungsinformationen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.subscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Tier</label>
                      <p className="text-sm mt-1 capitalize">{subscription.tier || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <p className="text-sm mt-1 capitalize">{subscription.status}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Zeitraum</label>
                      <p className="text-sm mt-1">
                        {formatDate(subscription.currentPeriodStart)} -{" "}
                        {formatDate(subscription.currentPeriodEnd)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Stripe-ID</label>
                      <p className="text-sm mt-1 font-mono text-xs truncate">
                        {subscription.stripeSubscriptionId}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GDPR Information */}
      <Card>
        <CardHeader>
          <CardTitle>Datenverarbeitung & Ihre Rechte</CardTitle>
          <CardDescription>Transparenz gemäß DSGVO</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Drittanbieter</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Google Cloud Platform:</strong> Hosting, Speicherung, AI-Verarbeitung (Gemini)</li>
              <li>• <strong>Stripe:</strong> Zahlungsabwicklung und Abo-Verwaltung</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Ihre DSGVO-Rechte</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ <strong>Recht auf Auskunft (Art. 15):</strong> Diese Seite</li>
              <li>✓ <strong>Recht auf Datenportabilität (Art. 20):</strong> JSON-Export-Funktion oben</li>
              <li>✓ <strong>Recht auf Löschung (Art. 17):</strong> Verfügbar in den{" "}
                <Link href="/dashboard/settings" className="underline">
                  Einstellungen
                </Link>
              </li>
              <li>• <strong>Weitere Rechte:</strong> Kontaktieren Sie support@echoscribe.de</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Aufbewahrungsfristen</h3>
            <p className="text-sm text-muted-foreground">
              Alle Daten werden bis zur Kontolöschung gespeichert. Nach Kontolöschung erfolgt
              die vollständige Datenlöschung innerhalb von 30 Tagen.
            </p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Weitere Informationen finden Sie in unserer{" "}
              <Link href="/privacy" className="underline">
                Datenschutzerklärung
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
