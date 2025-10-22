/**
 * EchoScribe Cloud Functions
 *
 * Export all Firebase Functions from their respective modules
 */

// Auth Triggers
export { onUserCreate } from "./triggers/onUserCreate";

// Storage Triggers
export { onPodcastUploaded } from "./triggers/onPodcastUploaded";
