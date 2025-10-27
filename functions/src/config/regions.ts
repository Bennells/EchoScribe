/**
 * Region Configuration for Cloud Functions
 *
 * ============================================
 * REGION STRATEGY
 * ============================================
 *
 * TEST (echoscribe-test):
 *   - Cloud Functions: europe-west1 (Belgien, Multi-Region EU)
 *   - Firestore: eur3 (Multi-Region Europa)
 *   - Tier 1 Pricing (günstiger)
 *   - Optimiert für Entwicklung und Testing
 *
 * PROD (echoscribe-prod):
 *   - Cloud Functions: europe-west3 (Frankfurt, Deutschland)
 *   - Firestore: europe-west3 (Frankfurt, Deutschland)
 *   - Tier 2 Pricing (~20% teurer)
 *   - 100% Deutschland-Hosting für Datensouveränität
 *
 * ============================================
 * WICHTIG: Nur hier die Regionen ändern!
 * ============================================
 */

export const REGIONS = {
  // TEST/Development: Multi-Region EU (aktuell)
  development: "europe-west1" as const,  // Belgien, Tier 1

  // PRODUCTION: Deutschland-Only (Frankfurt)
  production: "europe-west3" as const,   // Frankfurt 🇩🇪, Tier 2
};

/**
 * Automatische Region-Erkennung basierend auf Projekt-ID
 *
 * Erkennt automatisch:
 * - echoscribe-test → europe-west1 (Multi-Region EU)
 * - echoscribe-prod → europe-west3 (Deutschland)
 *
 * @returns Die Region für das aktuelle Environment
 */
export function getCurrentRegion(): string {
  const projectId = process.env.GCLOUD_PROJECT || "echoscribe-test";
  const isProduction = projectId.includes("prod");

  return isProduction ? REGIONS.production : REGIONS.development;
}

/**
 * Region-Informationen für Logging und Debugging
 *
 * @returns Detaillierte Informationen über die aktuelle Region und Environment
 */
export function getRegionInfo() {
  const region = getCurrentRegion();
  const projectId = process.env.GCLOUD_PROJECT || "unknown";
  const isProduction = projectId.includes("prod");

  return {
    region,
    projectId,
    environment: isProduction ? "PRODUCTION" : "DEVELOPMENT/TEST",
    isGermany: region === "europe-west3",
    pricingTier: region === "europe-west3" ? "Tier 2" : "Tier 1",
    hosting: isProduction
      ? "🇩🇪 Deutschland (Frankfurt)"
      : "🇪🇺 Multi-Region EU (Belgien)",
  };
}

/**
 * Verfügbare Regionen für Referenz
 *
 * Deutschland:
 * - europe-west3 (Frankfurt) - Tier 2 Pricing
 *
 * Andere EU-Regionen:
 * - europe-west1 (Belgien) - Tier 1 Pricing ⭐
 * - europe-west2 (London, UK) - Tier 1 Pricing
 * - europe-west4 (Niederlande) - Tier 1 Pricing
 * - europe-west6 (Zürich, Schweiz) - Tier 2 Pricing
 *
 * Vollständige Liste:
 * https://firebase.google.com/docs/functions/locations
 */
