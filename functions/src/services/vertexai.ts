import { VertexAI } from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { BLOG_GENERATION_PROMPT } from "../utils/prompts";
import { config } from "../config/environment";
import type { BlogArticle } from "../types/podcast";

/**
 * Retry a function with exponential backoff on rate limit errors
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param initialDelay Initial delay in milliseconds (default: 1000ms)
 * @returns Result of the function
 */
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Try to execute the function
      const result = await fn();

      // Log success after retry
      if (attempt > 0) {
        logger.info(`[Retry] ✅ Success after ${attempt} retry attempt(s)`);
      }

      return result;
    } catch (error: any) {
      lastError = error;

      // Check if this is a rate limit error
      const isRateLimitError =
        error.status === 429 ||
        error.code === "RESOURCE_EXHAUSTED" ||
        error.message?.toLowerCase().includes("quota") ||
        error.message?.toLowerCase().includes("rate limit") ||
        error.message?.toLowerCase().includes("too many requests");

      // If not a rate limit error, throw immediately (no retry)
      if (!isRateLimitError) {
        throw error;
      }

      // If we've exhausted all retries, throw the error
      if (attempt === maxRetries) {
        logger.error(`[Retry] ❌ Failed after ${maxRetries} retry attempts`, {
          errorMessage: error.message,
          errorCode: error.code,
          errorStatus: error.status,
        });
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // Random 0-1000ms
      const totalDelay = exponentialDelay + jitter;

      logger.warn(`[Retry] Rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(totalDelay)}ms...`, {
        errorMessage: error.message,
        errorCode: error.code,
        errorStatus: error.status,
        nextRetryIn: `${Math.round(totalDelay)}ms`,
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

let vertexAI: VertexAI;

/**
 * Parse JSON from Gemini response with multiple fallback strategies
 * @param text Raw response text from Gemini
 * @returns Parsed BlogArticle object
 */
function parseArticleJson(text: string): BlogArticle {
  let cleanText = text.trim();

  // Log raw response for debugging
  logger.info(`[JSON Parser] Raw response length: ${text.length} chars`);
  logger.info(`[JSON Parser] First 200 chars: ${text.substring(0, 200)}`);
  logger.info(`[JSON Parser] Last 200 chars: ${text.substring(Math.max(0, text.length - 200))}`);

  // Strategy 1: Try to extract JSON from code fences FIRST (before any modifications)
  // This catches cases like "```json\n{...}\n```" or "Here's the JSON:\n```json\n{...}\n```"
  const fenceMatch = cleanText.match(/```(?:json)?[\s\n\r]*(\{[\s\S]*?\})[\s\n\r]*```/i);
  if (fenceMatch) {
    cleanText = fenceMatch[1].trim();
    logger.info("[JSON Parser] Extracted JSON from code fence (strategy 1)");
  } else {
    // Strategy 2: Remove Markdown code fences manually
    // Remove opening fence: ```json or ``` with any whitespace before/after
    cleanText = cleanText.replace(/^[\s\n\r]*```(?:json)?[\s\n\r]*/i, "");
    // Remove closing fence: ``` with any whitespace before/after
    cleanText = cleanText.replace(/[\s\n\r]*```[\s\n\r]*$/g, "");
    cleanText = cleanText.trim();
    logger.info("[JSON Parser] Removed markdown fences manually (strategy 2)");
  }

  logger.info(`[JSON Parser] After markdown removal, length: ${cleanText.length} chars`);
  logger.info(`[JSON Parser] Cleaned text starts with: ${cleanText.substring(0, 100)}`);
  logger.info(`[JSON Parser] Cleaned text ends with: ${cleanText.substring(Math.max(0, cleanText.length - 100))}`);

  // Strategy 3: Extract JSON object (handles nested braces)
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logger.error(`[JSON Parser] No JSON object found after cleaning`);
    logger.error(`[JSON Parser] Cleaned text (first 500): ${cleanText.substring(0, 500)}`);
    logger.error(`[JSON Parser] Cleaned text (last 500): ${cleanText.substring(Math.max(0, cleanText.length - 500))}`);
    throw new Error("No JSON object found in response");
  }

  let jsonString = jsonMatch[0];
  logger.info(`[JSON Parser] Extracted JSON string length: ${jsonString.length} chars`);

  // Try multiple parsing strategies
  // Note: With responseMimeType: "application/json", the model guarantees valid JSON,
  // so Strategy 1 should always work. Strategies 2+ are fallbacks for edge cases.
  const strategies = [
    // Strategy 1: Parse as-is (should always work with JSON mode enabled)
    () => JSON.parse(jsonString),

    // Strategy 2: Fallback - basic manual extraction (should rarely be needed with JSON mode)
    () => {
      logger.warn("[JSON Parser] Strategy 2: Basic field extraction as fallback...");

      // This is a simplified fallback that only exists for unexpected edge cases.
      // With responseMimeType: "application/json", this should never execute.
      throw new Error("JSON parsing failed even with guaranteed valid JSON mode - check response format");
    }
  ];

  // Try each strategy in order
  let lastError: any;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      logger.info(`[JSON Parser] ✅ Successfully parsed with strategy ${i + 1}`);
      return result;
    } catch (error: any) {
      lastError = error;
      if (i < strategies.length - 1) {
        logger.warn(`[JSON Parser] Strategy ${i + 1} failed: ${error.message}`);
      }
    }
  }

  // All strategies failed
  throw new Error(`All parsing strategies failed. Last error: ${lastError.message}`);
}

/**
 * Process audio file using Vertex AI Gemini API
 *
 * Uses Cloud Storage gs:// URIs instead of downloading and encoding audio.
 * This reduces memory usage and processing time significantly.
 *
 * @param storagePath - Cloud Storage path (e.g., "podcasts/userId/file.mp3")
 * @param mimeType - MIME type of audio file (default: "audio/mpeg")
 * @returns Parsed BlogArticle
 */
export async function processAudioWithVertexAI(
  storagePath: string,
  mimeType: string = "audio/mpeg"
): Promise<BlogArticle> {
  try {
    // Initialize Vertex AI client if not already done (only logs on first init)
    if (!vertexAI) {
      logger.info("[Vertex AI] Initializing client...");
      try {
        const projectId = config.projectId;
        const location = config.region; // europe-west1 or europe-west3

        vertexAI = new VertexAI({
          project: projectId,
          location: location,
        });

        const regionInfo = config.region === "europe-west3"
          ? "Germany (Frankfurt)"
          : "EU (Belgium)";

        logger.info(`[Vertex AI] ✅ Client initialized | Region: ${regionInfo} | Endpoint: ${location}-aiplatform.googleapis.com`);
      } catch (error: any) {
        logger.error("[Vertex AI] ❌ Failed to initialize client:", {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }

    // Get generative model with increased output token limit and JSON mode
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 16384, // Increased from default to handle long blog articles with all metadata
        temperature: 0.7, // Balanced creativity and consistency
        responseMimeType: "application/json", // Ensures valid JSON output with proper escaping
      },
    });

    // Construct Cloud Storage URI
    const bucketName = admin.storage().bucket().name;
    const gsUri = `gs://${bucketName}/${storagePath}`;

    logger.info(`[Vertex AI] Sending audio to API | Model: gemini-2.5-flash | Type: ${mimeType}`);

    // Prepare request with Cloud Storage URI
    const filePart = {
      fileData: {
        fileUri: gsUri,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: BLOG_GENERATION_PROMPT,
    };

    const request = {
      contents: [{ role: "user", parts: [filePart, textPart] }],
    };

    // Send request with automatic retry on rate limits
    const startTime = Date.now();
    const result = await retryWithExponentialBackoff(async () => {
      return await model.generateContent(request);
    });
    const duration = Date.now() - startTime;

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Check if response was truncated
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS" || finishReason === "SAFETY") {
      logger.warn(`[Vertex AI] ⚠️ Response truncated! Finish reason: ${finishReason}`);
      if (finishReason === "MAX_TOKENS") {
        logger.warn("[Vertex AI] Response hit token limit - increase maxOutputTokens if needed");
      }
    }

    // Extract token usage information
    const usageMetadata = (response as any).usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const responseTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = usageMetadata?.totalTokenCount || 0;

    // Estimate costs (Gemini 2.5 Flash pricing: Audio $1.00/1M, Text $2.50/1M)
    const estimatedCost =
      totalTokens > 0
        ? (promptTokens / 1_000_000) * 1.0 + (responseTokens / 1_000_000) * 2.5
        : 0;

    logger.info(`[Vertex AI] ✅ API call completed | Duration: ${(duration / 1000).toFixed(1)}s | Tokens: ${totalTokens.toLocaleString()} | Cost: $${estimatedCost.toFixed(4)}`);

    // Log full response for debugging (only if needed)
    if (text.length < 50000) {
      logger.info(`[Vertex AI] Full raw response (${text.length} chars):`, text);
    } else {
      logger.info(`[Vertex AI] Raw response too large (${text.length} chars), logging excerpts only`);
    }

    // Parse JSON response (same logic as Google AI Studio)
    let article: BlogArticle;
    try {
      article = parseArticleJson(text);
    } catch (parseError: any) {
      logger.error("Failed to parse Vertex AI response as JSON:", parseError);
      logger.error("Response text (first 1000 chars):", text.substring(0, 1000));
      logger.error(
        "Response text (last 500 chars):",
        text.substring(Math.max(0, text.length - 500))
      );
      throw new Error(`Invalid JSON response from Vertex AI: ${parseError.message}`);
    }

    // Comprehensive validation of critical fields
    const validationErrors: string[] = [];

    // Basic required fields
    if (!article.title || article.title.trim().length === 0) {
      validationErrors.push("title is missing or empty");
    }
    if (!article.markdown || article.markdown.length < 100) {
      validationErrors.push("markdown is missing or too short (< 100 chars)");
    }
    if (!article.html || article.html.length < 100) {
      validationErrors.push("html is missing or too short (< 100 chars)");
    }

    // Social media validation - all 6 platforms should be present
    if (!article.socialMedia) {
      validationErrors.push("socialMedia is completely missing");
    } else {
      const requiredPlatforms: (keyof typeof article.socialMedia)[] = ["linkedin", "twitter", "instagram", "facebook", "tiktok", "newsletter"];
      const missingPlatforms = requiredPlatforms.filter(platform => !article.socialMedia![platform]);
      if (missingPlatforms.length > 0) {
        validationErrors.push(`socialMedia is incomplete - missing platforms: ${missingPlatforms.join(", ")}`);
      }

      // Validate each platform has content
      for (const platform of requiredPlatforms) {
        const content = article.socialMedia![platform];
        if (content && typeof content === "object") {
          const contentStr = JSON.stringify(content);
          if (contentStr.length < 20) {
            validationErrors.push(`socialMedia.${platform} has suspiciously little content`);
          }
        }
      }
    }

    // Schema.org validation
    if (!article.schemaOrg) {
      validationErrors.push("schemaOrg is completely missing");
    } else {
      if (!article.schemaOrg["@context"] || !article.schemaOrg["@type"]) {
        validationErrors.push("schemaOrg is missing required @context or @type");
      }
      if (!article.schemaOrg.author) {
        validationErrors.push("schemaOrg is missing required author field");
      }
    }

    // OpenGraph validation
    if (!article.openGraph) {
      validationErrors.push("openGraph is completely missing");
    } else {
      const requiredOgFields = ["og:title", "og:description", "og:type"];
      const missingOgFields = requiredOgFields.filter(field => !article.openGraph![field]);
      if (missingOgFields.length > 0) {
        validationErrors.push(`openGraph is incomplete - missing fields: ${missingOgFields.join(", ")}`);
      }
    }

    // If there are validation errors, throw detailed error
    if (validationErrors.length > 0) {
      logger.error("[Vertex AI] ❌ Article validation failed:");
      validationErrors.forEach(error => logger.error(`  - ${error}`));
      logger.error("[Vertex AI] Parsed article structure:", {
        hasSocialMedia: !!article.socialMedia,
        socialMediaPlatforms: article.socialMedia ? Object.keys(article.socialMedia) : [],
        hasSchemaOrg: !!article.schemaOrg,
        schemaOrgKeys: article.schemaOrg ? Object.keys(article.schemaOrg) : [],
        hasOpenGraph: !!article.openGraph,
        openGraphKeys: article.openGraph ? Object.keys(article.openGraph) : [],
        htmlLength: article.html?.length || 0,
        markdownLength: article.markdown?.length || 0,
      });
      throw new Error(`Article validation failed: ${validationErrors.join("; ")}`);
    }

    // Log parsing result
    const wordCount = article.markdown.split(/\s+/).length;
    logger.info(`[Vertex AI] ✅ Article parsed | Words: ${wordCount.toLocaleString()}`);

    return article;
  } catch (error: any) {
    logger.error("=".repeat(80));
    logger.error("[Vertex AI] ❌ Error processing audio with Vertex AI:", {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      errorStack: error.stack,
      storagePath,
    });
    logger.error("=".repeat(80));
    throw error;
  }
}

/**
 * Test Vertex AI connection
 */
export async function testVertexAIConnection(): Promise<boolean> {
  try {
    if (!vertexAI) {
      vertexAI = new VertexAI({
        project: config.projectId,
        location: config.region,
      });
    }

    const model = vertexAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Hello, test" }] }],
    });
    return !!result.response;
  } catch (error) {
    logger.error("Vertex AI connection test failed:", error);
    return false;
  }
}
