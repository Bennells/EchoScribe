"use server";

import { getUserData } from "./getUserData";

export interface GDPRDataExport {
  exportDate: string;
  exportVersion: string;
  userData: {
    email: string;
    accountCreated: string;
    tier: string;
    subscriptionStatus: string;
    quota: {
      monthly: number;
      used: number;
      resetAt?: string;
    };
    stripeCustomerId?: string;
  } | null;
  podcasts: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    status: string;
    storagePath: string;
    downloadUrl?: string;
    duration?: number;
    processingStartedAt?: string;
    processingCompletedAt?: string;
    errorMessage?: string;
  }>;
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    createdAt: string;
    editedAt?: string;
    contentMarkdown: string;
    metaDescription?: string;
    keywords?: string[];
  }>;
  subscriptions: Array<{
    id: string;
    stripeSubscriptionId: string;
    status: string;
    tier?: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  }>;
  gdprInformation: {
    dataCategories: {
      category: string;
      description: string;
      fields: string[];
    }[];
    processingPurposes: string[];
    thirdPartyRecipients: {
      name: string;
      purpose: string;
      dataShared: string[];
    }[];
    retentionPolicy: string;
    userRights: string[];
  };
}

/**
 * Export user data in GDPR-compliant JSON format (Art. 15 + Art. 20)
 * Returns structured, machine-readable data with full transparency information
 */
export async function exportUserData(): Promise<{
  success: boolean;
  data?: GDPRDataExport;
  error?: string;
}> {
  try {
    // Fetch all user data
    const result = await getUserData();

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to fetch user data",
      };
    }

    const { user, podcasts, articles, subscriptions } = result.data;

    // Format data for GDPR export
    const gdprExport: GDPRDataExport = {
      exportDate: new Date().toISOString(),
      exportVersion: "1.0",

      userData: user
        ? {
            email: user.email,
            accountCreated: user.createdAt?.toDate?.()?.toISOString() || "",
            tier: user.tier || "free",
            subscriptionStatus: user.subscriptionStatus,
            quota: {
              monthly: user.quota.monthly,
              used: user.quota.used,
              resetAt: user.quota.resetAt?.toDate?.()?.toISOString(),
            },
            stripeCustomerId: user.stripeCustomerId,
          }
        : null,

      podcasts: podcasts.map((podcast) => ({
        id: podcast.id,
        fileName: podcast.fileName,
        fileSize: podcast.fileSize,
        uploadedAt: podcast.uploadedAt?.toDate?.()?.toISOString() || "",
        status: podcast.status,
        storagePath: podcast.storagePath,
        downloadUrl: podcast.downloadUrl,
        duration: podcast.duration,
        processingStartedAt: podcast.processingStartedAt
          ?.toDate?.()
          ?.toISOString(),
        processingCompletedAt: podcast.processingCompletedAt
          ?.toDate?.()
          ?.toISOString(),
        errorMessage: podcast.errorMessage,
      })),

      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        slug: article.slug,
        createdAt: article.createdAt?.toDate?.()?.toISOString() || "",
        editedAt: article.editedAt?.toDate?.()?.toISOString(),
        contentMarkdown: article.contentMarkdown,
        metaDescription: article.metaDescription,
        keywords: article.keywords,
      })),

      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        status: subscription.status,
        tier: subscription.tier,
        currentPeriodStart:
          subscription.currentPeriodStart?.toDate?.()?.toISOString() || "",
        currentPeriodEnd:
          subscription.currentPeriodEnd?.toDate?.()?.toISOString() || "",
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
            fields: [
              "Erstellungsdatum",
              "Abo-Tier",
              "Abo-Status",
              "Quota-Nutzung",
            ],
          },
          {
            category: "Inhaltsdaten",
            description: "Von Ihnen hochgeladene und generierte Inhalte",
            fields: [
              "Podcast-Audiodateien",
              "Generierte Artikel",
              "Dateinamen",
              "Metadaten",
            ],
          },
          {
            category: "Finanzdaten",
            description: "Zahlungsbezogene Informationen",
            fields: [
              "Abo-Informationen",
              "Abrechnungszeiträume",
              "Stripe-Referenzen",
            ],
          },
          {
            category: "Nutzungsdaten",
            description: "Technische Daten zur Service-Nutzung",
            fields: [
              "Upload-Zeitstempel",
              "Verarbeitungsstatus",
              "Quota-Zähler",
            ],
          },
        ],

        processingPurposes: [
          "Kontoverwaltung und Authentifizierung",
          "Service-Bereitstellung (Podcast-zu-Artikel-Konvertierung)",
          "Abrechnung und Abo-Verwaltung",
          "Service-Verbesserung und Fehleranalyse",
          "Einhaltung gesetzlicher Verpflichtungen",
        ],

        thirdPartyRecipients: [
          {
            name: "Google Cloud Platform",
            purpose: "Hosting und AI-Verarbeitung",
            dataShared: [
              "Audiodateien",
              "Nutzerdaten",
              "Generierte Inhalte",
              "Technische Logs",
            ],
          },
          {
            name: "Stripe Inc.",
            purpose: "Zahlungsabwicklung",
            dataShared: [
              "E-Mail-Adresse",
              "Stripe-Kunden-ID",
              "Abo-Informationen",
            ],
          },
        ],

        retentionPolicy:
          "Alle Daten werden bis zur Kontolöschung gespeichert. Nach Kontolöschung werden alle Daten innerhalb von 30 Tagen vollständig gelöscht. Backup-Daten werden nach 90 Tagen automatisch gelöscht.",

        userRights: [
          "Recht auf Auskunft (Art. 15 DSGVO) - Diese Exportfunktion",
          "Recht auf Berichtigung (Art. 16 DSGVO) - Kontaktieren Sie support@echoscribe.de",
          "Recht auf Löschung (Art. 17 DSGVO) - Verfügbar in den Kontoeinstellungen",
          "Recht auf Datenportabilität (Art. 20 DSGVO) - Diese Exportfunktion",
          "Recht auf Widerspruch (Art. 21 DSGVO) - Kontaktieren Sie support@echoscribe.de",
          "Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO) - Kontaktieren Sie support@echoscribe.de",
        ],
      },
    };

    return {
      success: true,
      data: gdprExport,
    };
  } catch (error: any) {
    console.error("Error exporting user data:", error);
    return {
      success: false,
      error: error.message || "Failed to export user data",
    };
  }
}
