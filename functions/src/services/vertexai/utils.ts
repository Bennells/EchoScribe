import * as logger from "firebase-functions/logger";
import { VERTEX_AI_REQUEST_TIMEOUT_MS } from "./constants";

/**
 * Execute a function with a timeout
 *
 * If the function doesn't complete within the specified timeout,
 * a timeout error is thrown.
 *
 * @param fn Function to execute
 * @param timeoutMs Timeout in milliseconds (default from constants)
 * @param operationName Name of operation for error messages
 * @returns Result of the function
 * @throws Error if timeout is exceeded
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = VERTEX_AI_REQUEST_TIMEOUT_MS,
  operationName: string = "Operation"
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `${operationName} timed out after ${timeoutMs / 1000}s. ` +
            `Consider increasing timeout or checking API availability.`
          )
        );
      }, timeoutMs);
    }),
  ]);
}

/**
 * Retry a function with exponential backoff on rate limit errors
 *
 * This utility handles transient errors (rate limits, quotas) by automatically
 * retrying with increasing delays. Non-retryable errors are thrown immediately.
 *
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param initialDelay Initial delay in milliseconds (default: 1000ms)
 * @returns Result of the function
 * @throws Last error if all retries fail, or immediately for non-retryable errors
 */
/**
 * Error structure for retry logic
 */
interface RetryableError extends Error {
  status?: number;
  code?: string;
}

export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Try to execute the function
      const result = await fn();

      // Log success after retry
      if (attempt > 0) {
        logger.info(`[Retry] ✅ Success after ${attempt} retry attempt(s)`);
      }

      return result;
    } catch (error: unknown) {
      // Type guard for error handling
      const typedError = error instanceof Error ? error : new Error(String(error));
      lastError = typedError;

      const retryableError = typedError as RetryableError;

      // Check if this is a rate limit error
      const isRateLimitError =
        retryableError.status === 429 ||
        retryableError.code === "RESOURCE_EXHAUSTED" ||
        retryableError.message?.toLowerCase().includes("quota") ||
        retryableError.message?.toLowerCase().includes("rate limit") ||
        retryableError.message?.toLowerCase().includes("too many requests");

      // If not a rate limit error, throw immediately (no retry)
      if (!isRateLimitError) {
        throw retryableError;
      }

      // If we've exhausted all retries, throw the error
      if (attempt === maxRetries) {
        logger.error(`[Retry] ❌ Failed after ${maxRetries} retry attempts`, {
          errorMessage: retryableError.message,
          errorCode: retryableError.code,
          errorStatus: retryableError.status,
        });
        throw retryableError;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // Random 0-1000ms
      const totalDelay = exponentialDelay + jitter;

      logger.warn(`[Retry] Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(totalDelay)}ms...`, {
        errorMessage: retryableError.message,
        errorCode: retryableError.code,
        errorStatus: retryableError.status,
        nextRetryIn: `${Math.round(totalDelay)}ms`,
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Retry failed with unknown error");
}

/**
 * Auto-fix metaDescription to meet SEO length requirements (100-160 characters)
 *
 * SEO best practices require meta descriptions between 100-160 characters.
 * This function ensures compliance by truncating long descriptions or
 * extending short ones with standard suffixes.
 *
 * @param description The original description
 * @returns Fixed description within the valid length range
 */
export function fixMetaDescription(description: string): string {
  if (!description) return "";

  // If too long, truncate intelligently at word boundary
  if (description.length > 160) {
    const truncated = description.substring(0, 157);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 140) { // Keep at least 140 chars
      return truncated.substring(0, lastSpace) + "...";
    }
    return truncated + "...";
  }

  // If too short, add a standard suffix
  if (description.length < 100) {
    const suffix = " | Jetzt den vollständigen Artikel lesen und alle Details erfahren.";
    const combined = description + suffix;
    // Make sure we don't go over 160 after adding suffix
    if (combined.length > 160) {
      return description + " | Mehr im Artikel."; // Shorter suffix
    }
    return combined;
  }

  return description;
}

/**
 * Validate article completeness and throw errors for invalid content
 *
 * Performs comprehensive analysis of article quality including:
 * - Word count validation (minimum 400 words)
 * - Structure analysis (headings required)
 * - Completeness checks (proper ending, no truncation)
 * - Content previews for debugging
 *
 * This is BLOCKING validation that throws errors for incomplete articles.
 *
 * @param markdown The markdown content to validate
 * @param stage Stage identifier for logging (e.g., "Stage 1", "Direct")
 * @throws Error if article doesn't meet minimum quality requirements
 */
export function validateArticleCompleteness(markdown: string, stage: string): void {
  if (!markdown || markdown.trim().length === 0) {
    logger.error(`[${stage}] ❌ Article is empty`);
    throw new Error(`[${stage}] Article validation failed: Article content is empty`);
  }

  // Word count analysis
  const words = markdown.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Log metrics
  logger.info(`[${stage}] 📊 Article Metrics:`);
  logger.info(`[${stage}]    - Word count: ${wordCount}`);
  logger.info(`[${stage}]    - Character count: ${markdown.length}`);

  // BLOCKING: Enforce minimum word count
  if (wordCount < 400) {
    logger.error(`[${stage}] ❌ Article is too short: ${wordCount} words (minimum: 400 words)`);
    logger.error(`[${stage}] Article content preview: ${markdown.slice(0, 300)}...`);
    throw new Error(`[${stage}] Article validation failed: Only ${wordCount} words (minimum: 400 words required)`);
  }

  // Structure analysis
  const hasH1 = markdown.includes('# ');
  const hasH2 = markdown.includes('## ');
  const hasFazit = /##\s*(Fazit|Zusammenfassung|Schluss|Abschluss)/i.test(markdown);
  const lastChar = markdown.trim().slice(-1);
  const endsWithPunctuation = ['.', '!', '?', ')'].includes(lastChar);

  logger.info(`[${stage}]    - Has H1 heading: ${hasH1 ? '✅' : '❌'}`);
  logger.info(`[${stage}]    - Has H2 sections: ${hasH2 ? '✅' : '❌'}`);
  logger.info(`[${stage}]    - Has conclusion (Fazit): ${hasFazit ? '✅' : '⚠️'}`);
  logger.info(`[${stage}]    - Ends with punctuation: ${endsWithPunctuation ? '✅' : `❌ (last char: '${lastChar}')`}`);

  // BLOCKING: Check for basic structure
  if (!hasH1) {
    logger.error(`[${stage}] ❌ Article missing H1 heading`);
    throw new Error(`[${stage}] Article validation failed: No H1 heading found`);
  }

  if (!hasH2) {
    logger.error(`[${stage}] ❌ Article missing H2 sections`);
    throw new Error(`[${stage}] Article validation failed: No H2 sections found - article needs proper structure`);
  }

  // BLOCKING: Check for proper ending (not truncated mid-sentence)
  if (!endsWithPunctuation) {
    const endContext = markdown.trim().slice(-150);
    logger.error(`[${stage}] ❌ Article doesn't end with punctuation - likely truncated`);
    logger.error(`[${stage}] Last 150 characters: ...${endContext}`);
    throw new Error(`[${stage}] Article validation failed: Article appears truncated (doesn't end with punctuation). Last char: '${lastChar}'`);
  }

  // Log preview of article start and end for debugging
  const preview = markdown.trim().slice(0, 200);
  const endPreview = markdown.trim().slice(-200);
  logger.info(`[${stage}] 📄 Article Preview (first 200 chars):`);
  logger.info(`[${stage}]    ${preview.replace(/\n/g, ' ')}...`);
  logger.info(`[${stage}] 📄 Article End (last 200 chars):`);
  logger.info(`[${stage}]    ...${endPreview.replace(/\n/g, ' ')}`);

  logger.info(`[${stage}] ✅ Article validation passed - content is complete`);
}
