/**
 * OpenAI Service Constants
 */

/** Default timeout for OpenAI API requests (2 minutes) */
export const OPENAI_REQUEST_TIMEOUT_MS = 120000;

/** GPT-4o-transcribe transcription timeout (60 minutes - matches function timeout for maximum safety) */
export const TRANSCRIPTION_TIMEOUT_MS = 3600000;

/** Maximum file size for GPT-4o-transcribe API (25 MB) */
export const TRANSCRIPTION_MAX_FILE_SIZE_MB = 25;

/** Maximum output tokens for article generation (GPT-4o-mini) */
export const MAX_OUTPUT_TOKENS_ARTICLE = 8192;

/** Maximum output tokens for metadata generation (GPT-4o-mini) */
export const MAX_OUTPUT_TOKENS_METADATA = 2500;

/** Circuit breaker settings */
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
export const CIRCUIT_BREAKER_COOLDOWN_MS = 60000; // 1 minute

/** Maximum retry attempts for rate-limited requests */
export const MAX_RETRY_ATTEMPTS = 3;

/** Initial delay for exponential backoff (milliseconds) */
export const INITIAL_RETRY_DELAY_MS = 1000;
