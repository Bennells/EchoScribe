/**
 * EchoScribe Cloud Functions
 *
 * Export all Firebase Functions from their respective modules
 */

// Define secrets that functions need access to
import { defineSecret } from "firebase-functions/params";

// Gemini API Key - stored in Google Secret Manager
// This is just a reference, not the actual value
export const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");

// Storage Triggers
export { onPodcastUploaded } from "./triggers/onPodcastUploaded";

// Cloud Tasks
export { processPodcastTask } from "./tasks/processPodcastTask";
