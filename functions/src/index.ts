/**
 * EchoScribe Cloud Functions
 *
 * Export all Firebase Functions from their respective modules
 */

// Storage Triggers
export { onPodcastUploaded } from "./triggers/onPodcastUploaded";

// Cloud Tasks
export { processPodcastTask } from "./tasks/processPodcastTask";
