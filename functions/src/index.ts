/**
 * EchoScribe Cloud Functions
 *
 * Export all Firebase Functions from their respective modules
 *
 * Note: Vertex AI authentication uses Workload Identity Federation (WIF)
 * via Application Default Credentials (ADC). No API keys needed!
 */

// Storage Triggers
export { onPodcastUploaded } from "./triggers/onPodcastUploaded";

// HTTP Functions (2nd Gen - 60 minute timeout)
export { processPodcastHttp } from "./http/processPodcastHttp";

// Scheduled Functions (Cleanup & Maintenance)
export { cleanupStuckPodcasts } from "./scheduled/cleanupStuckPodcasts";
