/**
 * Constants for Vertex AI / Gemini Processing
 *
 * Centralizes all magic numbers and configuration values for
 * maintainability and consistency across the codebase.
 */

// ============================================
// MODEL CONFIGURATION
// ============================================

/** Gemini model to use for both stages */
export const GEMINI_MODEL = "gemini-2.5-flash";

/** Maximum output tokens for Stage 1 (Article Generation) */
export const MAX_OUTPUT_TOKENS_ARTICLE = 65536;

/** Maximum output tokens for Stage 2 (Metadata Generation) */
export const MAX_OUTPUT_TOKENS_METADATA = 65536;

/** Temperature for creative article generation (0.0-1.0) */
export const TEMPERATURE_ARTICLE = 0.7;

/** Temperature for metadata generation (0.0-1.0) */
export const TEMPERATURE_METADATA = 0.7;

/** Top-P sampling parameter */
export const TOP_P = 0.9;

/** Top-K sampling parameter */
export const TOP_K = 40;

// ============================================
// WORD COUNT TARGETS
// ============================================

/**
 * Minimum word count for article validation
 * NOTE: This is a hard minimum. Articles below this will be rejected.
 */
export const MIN_WORD_COUNT = 400;

/**
 * Target word count for teaser articles (baseline)
 * Used when duration is not available
 */
export const TARGET_WORD_COUNT_DEFAULT = 600;

/**
 * Duration-based word count targets
 * These are used to calculate appropriate article length based on podcast duration
 */
export const WORD_COUNT_BY_DURATION = {
  /** Short podcasts (15-30 minutes): 800-1000 words */
  SHORT: {
    minDuration: 15,
    maxDuration: 30,
    minWords: 800,
    maxWords: 1000,
  },
  /** Medium podcasts (30-90 minutes): 1000-1500 words */
  MEDIUM: {
    minDuration: 30,
    maxDuration: 90,
    minWords: 1000,
    maxWords: 1500,
  },
  /** Long podcasts (90+ minutes): 1500-2000 words */
  LONG: {
    minDuration: 90,
    maxDuration: Infinity,
    minWords: 1500,
    maxWords: 2000,
  },
};

// ============================================
// METADATA CONSTRAINTS
// ============================================

/** SEO title maximum length (Google recommendation) */
export const MAX_TITLE_LENGTH = 60;

/** Meta description minimum length */
export const MIN_META_DESCRIPTION_LENGTH = 100;

/** Meta description maximum length (Google recommendation) */
export const MAX_META_DESCRIPTION_LENGTH = 160;

/** Minimum number of keywords */
export const MIN_KEYWORDS = 5;

/** Maximum number of keywords */
export const MAX_KEYWORDS = 10;

// ============================================
// SOCIAL MEDIA CONSTRAINTS
// ============================================

/** LinkedIn post target length (characters) */
export const LINKEDIN_POST_LENGTH = { min: 250, max: 300 };

/** Twitter/X tweet maximum length (characters) */
export const TWITTER_TWEET_MAX_LENGTH = 280;

/** Twitter thread size (number of tweets) */
export const TWITTER_THREAD_SIZE = 4;

/** Instagram caption target length (words) */
export const INSTAGRAM_CAPTION_LENGTH = { min: 120, max: 150 };

/** Facebook post target length (words) */
export const FACEBOOK_POST_LENGTH = { min: 200, max: 250 };

/** Newsletter teaser maximum length (words) */
export const NEWSLETTER_MAX_WORDS = 100;

// ============================================
// RETRY CONFIGURATION
// ============================================

/** Maximum number of retry attempts for API calls */
export const MAX_RETRY_ATTEMPTS = 3;

/** Initial delay for exponential backoff (milliseconds) */
export const INITIAL_RETRY_DELAY_MS = 1000;

/** Maximum number of article generation attempts (for short articles) */
export const MAX_ARTICLE_GENERATION_ATTEMPTS = 2;

// ============================================
// TIMEOUT CONFIGURATION
// ============================================

/** Cloud Function timeout (seconds) - must match function config */
export const FUNCTION_TIMEOUT_SECONDS = 3600; // 60 minutes

/** Request-level timeout for Vertex AI calls (milliseconds) */
export const VERTEX_AI_REQUEST_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutes (buffer before function timeout)

// ============================================
// CIRCUIT BREAKER CONFIGURATION
// ============================================

/** Number of consecutive failures before circuit opens */
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;

/** Time to wait before attempting to close circuit (seconds) */
export const CIRCUIT_BREAKER_COOLDOWN_SECONDS = 60;

// ============================================
// LOGGING CONFIGURATION
// ============================================

/** Log progress every N chunks during streaming */
export const STREAMING_LOG_INTERVAL_CHUNKS = 10;

/** Log progress every N seconds during streaming */
export const STREAMING_LOG_INTERVAL_SECONDS = 5;

// ============================================
// COST CALCULATION
// ============================================

/**
 * Gemini 2.5 Flash pricing (as of 2025)
 * Source: https://cloud.google.com/vertex-ai/generative-ai/pricing
 *
 * Note: Prices are in USD per 1M tokens
 * Audio input pricing is separate from text input
 */
export const GEMINI_PRICING = {
  /** Text input cost per 1M tokens (USD) */
  INPUT_TEXT_PER_1M_TOKENS: 0.01875, // $0.01875 per 1M

  /** Text output cost per 1M tokens (USD) */
  OUTPUT_TEXT_PER_1M_TOKENS: 0.075, // $0.075 per 1M

  /** Audio input cost per minute (USD) - for podcasts/audio files */
  AUDIO_INPUT_PER_MINUTE: 0.000125, // $0.000125 per minute

  /** Context caching (if enabled) - discount on cached content */
  CONTEXT_CACHE_DISCOUNT: 0.1, // 90% discount on cached tokens
};

/**
 * EUR/USD exchange rate for cost calculation
 * Update this periodically or fetch from API
 */
export const EUR_USD_EXCHANGE_RATE = 1.08; // 1 EUR = 1.08 USD (approximate, update as needed)

// ============================================
// VALIDATION THRESHOLDS
// ============================================

/** Minimum number of H2 sections required in article */
export const MIN_H2_SECTIONS = 3;

/** Warning threshold for response length mismatch (streaming vs aggregated) */
export const RESPONSE_LENGTH_MISMATCH_THRESHOLD = 0.05; // 5% difference triggers warning

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get target word count based on podcast duration
 * @param durationMinutes Duration of podcast in minutes
 * @returns Target min and max word counts
 */
export function getTargetWordCount(durationMinutes?: number): {
  min: number;
  max: number;
} {
  if (!durationMinutes) {
    return { min: TARGET_WORD_COUNT_DEFAULT, max: TARGET_WORD_COUNT_DEFAULT + 400 };
  }

  if (durationMinutes >= WORD_COUNT_BY_DURATION.LONG.minDuration) {
    return {
      min: WORD_COUNT_BY_DURATION.LONG.minWords,
      max: WORD_COUNT_BY_DURATION.LONG.maxWords,
    };
  }

  if (durationMinutes >= WORD_COUNT_BY_DURATION.MEDIUM.minDuration) {
    return {
      min: WORD_COUNT_BY_DURATION.MEDIUM.minWords,
      max: WORD_COUNT_BY_DURATION.MEDIUM.maxWords,
    };
  }

  if (durationMinutes >= WORD_COUNT_BY_DURATION.SHORT.minDuration) {
    return {
      min: WORD_COUNT_BY_DURATION.SHORT.minWords,
      max: WORD_COUNT_BY_DURATION.SHORT.maxWords,
    };
  }

  // Very short podcasts (<15 min) - use short target
  return {
    min: WORD_COUNT_BY_DURATION.SHORT.minWords,
    max: WORD_COUNT_BY_DURATION.SHORT.maxWords,
  };
}
