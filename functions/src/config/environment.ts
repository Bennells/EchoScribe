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
   * URLs und Pfade werden automatisch generiert
   */
  functions: {
    processPodcastTask: {
      /** Function Name */
      name: "processPodcastTask",

      /**
       * Queue Path für Cloud Tasks
       * Format: locations/{region}/functions/{functionName}
       *
       * TEST: locations/europe-west1/functions/processPodcastTask
       * PROD: locations/europe-west3/functions/processPodcastTask
       */
      queuePath: `locations/${REGION}/functions/processPodcastTask`,

      /**
       * Function URI für Cloud Tasks HTTP Requests
       *
       * TEST: https://europe-west1-echoscribe-test.cloudfunctions.net/processPodcastTask
       * PROD: https://europe-west3-echoscribe-prod.cloudfunctions.net/processPodcastTask
       */
      uri: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/processPodcastTask`,
    },
  },

  /**
   * Cloud Tasks Konfiguration
   */
  cloudTasks: {
    /** Max dispatch deadline: 30 Minuten (API Maximum) */
    dispatchDeadlineSeconds: 30 * 60,
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
    functionUri: config.functions.processPodcastTask.uri,
  });
}
