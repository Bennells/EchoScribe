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

// Cloud Tasks
export { processPodcastTask } from "./tasks/processPodcastTask";
