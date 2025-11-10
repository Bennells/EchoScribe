import { getCurrentRegion, getRegionInfo } from "./regions";

/**
 * Environment Configuration
 *
 * Automatisch angepasst basierend auf dem deployed Environment:
 * - TEST (echoscribe-test): europe-west1, Multi-Region EU
 * - PROD (echoscribe-prod): europe-west3, Deutschland
 *
 * Alle URLs und Pfade werden automatisch generiert.
 */

// Automatisch erkannte Region und Projekt-ID
const REGION = getCurrentRegion();
const PROJECT_ID = process.env.GCLOUD_PROJECT || "echoscribe-test";

/**
 * Zentrale Environment-Konfiguration
 *
 * Wird automatisch aus Region und Projekt-ID generiert.
 * Keine manuelle Anpassung beim Wechsel zwischen TEST und PROD nötig!
 */
export const config = {
  /** Firebase Projekt-ID (z.B. echoscribe-test oder echoscribe-prod) */
  projectId: PROJECT_ID,

  /** Cloud Functions Region (TEST: europe-west1, PROD: europe-west3) */
  region: REGION,

  /**
   * Cloud Functions Konfiguration
   * URLs werden automatisch generiert
   */
  functions: {
    processPodcastHttp: {
      /** Function Name */
      name: "processPodcastHttp",

      /**
       * HTTP Function URI
       *
       * TEST: https://europe-west1-echoscribe-test.cloudfunctions.net/processPodcastHttp
       * PROD: https://europe-west3-echoscribe-prod.cloudfunctions.net/processPodcastHttp
       */
      uri: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/processPodcastHttp`,
    },
  },

  /**
   * Environment Detection Flags
   */
  get isProduction(): boolean {
    return PROJECT_ID.includes("prod");
  },

  get isDevelopment(): boolean {
    return !this.isProduction;
  },
} as const;

// Export Region-Info für Logging
export { getRegionInfo };

/**
 * Logging Helper für Function Startup
 *
 * Zeigt detaillierte Environment-Informationen beim Start einer Function.
 * Hilfreich für Debugging und Verifizierung der korrekten Region.
 *
 * @example
 * ```typescript
 * import { logEnvironment } from '../config/environment';
 *
 * export const myFunction = onRequest((req, res) => {
 *   logEnvironment();
 *   // ...
 * });
 * ```
 */
export function logEnvironment(): void {
  const info = getRegionInfo();

  console.log("🔧 Environment Configuration:", {
    project: config.projectId,
    environment: info.environment,
    region: config.region,
    hosting: info.hosting,
    pricingTier: info.pricingTier,
    httpFunctionUri: config.functions.processPodcastHttp.uri,
  });
}
