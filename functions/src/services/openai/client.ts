import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";

const openaiApiKey = defineSecret("OPENAI_API_KEY");

let openaiClient: OpenAI | null = null;

/**
 * Get API key for local development or production
 * In production: uses Firebase Functions secrets
 * In local development: uses process.env.OPENAI_API_KEY from .env.local
 */
function getApiKey(): string {
  // Check if we're in local development (process.env has the key directly)
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  // Production: use Firebase Functions secret
  return openaiApiKey.value();
}

/**
 * Get or create OpenAI client instance (singleton pattern)
 *
 * The client is configured with:
 * - API key from Firebase Functions secrets (production) or .env.local (local dev)
 * - No automatic retries (we handle retries ourselves with exponential backoff)
 * - 60-minute timeout (matches Cloud Function timeout for maximum safety)
 *
 * @returns OpenAI client instance
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: getApiKey(),
      maxRetries: 0, // We handle retries ourselves with retryWithExponentialBackoff
      timeout: 3600000, // 60 minutes (matches Cloud Function timeout)
    });
  }
  return openaiClient;
}

/**
 * Export the secret for use in Cloud Functions configuration
 */
export { openaiApiKey };
