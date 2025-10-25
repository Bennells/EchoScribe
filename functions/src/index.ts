/**
 * EchoScribe Cloud Functions
 *
 * Export all Firebase Functions from their respective modules
 */

// Initialize Sentry for Cloud Functions (only in production)
import "./lib/sentry";

// Storage Triggers
export { onPodcastUploaded } from "./triggers/onPodcastUploaded";

// Cloud Tasks
export { processPodcastTask } from "./tasks/processPodcastTask";

// Callable Functions
export { deleteUserAccount } from "./callable/deleteUserAccount";
