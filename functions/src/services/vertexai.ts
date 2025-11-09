import { VertexAI } from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { BLOG_GENERATION_PROMPT } from "../utils/prompts";
import { config } from "../config/environment";
import type { BlogArticle } from "./gemini";

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

  // Strategy 1: Remove Markdown code blocks
  cleanText = cleanText.replace(/^```(?:json)?\s*/i, ""); // Remove opening ```json or ```
  cleanText = cleanText.replace(/```\s*$/,  ""); // Remove closing ```
  cleanText = cleanText.trim();

  // Strategy 2: Extract JSON object (handles nested braces)
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in response");
  }

  let jsonString = jsonMatch[0];

  // Try multiple parsing strategies
  const strategies = [
    // Strategy 1: Parse as-is
    () => JSON.parse(jsonString),

    // Strategy 2: Fix invalid escape sequences
    () => {
      logger.warn("[JSON Parser] Strategy 2: Fixing escape sequences...");
      let fixed = jsonString.replace(/\\([^"\\\/bfnrtu])/g, "$1");
      return JSON.parse(fixed);
    },

    // Strategy 3: Aggressive quote escaping
    () => {
      logger.warn("[JSON Parser] Strategy 3: Aggressive quote fixing...");
      // Replace unescaped quotes in string values (but not property keys)
      let fixed = jsonString;
      // This regex finds quotes that are likely unescaped in values
      // It's not perfect but catches most cases
      fixed = fixed.replace(/([^\\])"([^",:}\]]*)"([^",:}\]]+)"/g, '$1\\"$2\\"$3"');
      return JSON.parse(fixed);
    },

    // Strategy 4: Relaxed JSON5-style parsing with manual reconstruction
    () => {
      logger.warn("[JSON Parser] Strategy 4: Manual field extraction...");
      const article: any = {};

      // Extract required string fields
      const extractField = (fieldName: string): string | null => {
        const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, "s");
        const match = jsonString.match(regex);
        return match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n") : null;
      };

      // Extract array fields
      const extractArray = (fieldName: string): any[] | null => {
        const regex = new RegExp(`"${fieldName}"\\s*:\\s*\\[([^\\]]+)\\]`, "s");
        const match = jsonString.match(regex);
        if (!match) return null;

        try {
          return JSON.parse(`[${match[1]}]`);
        } catch {
          // Fallback: split by comma and clean
          return match[1].split(",").map(s => s.trim().replace(/^"|"$/g, ""));
        }
      };

      // Extract object fields
      const extractObject = (fieldName: string): any | null => {
        const regex = new RegExp(`"${fieldName}"\\s*:\\s*(\\{[^}]+\\})`, "s");
        const match = jsonString.match(regex);
        if (!match) return null;

        try {
          return JSON.parse(match[1]);
        } catch {
          return {};
        }
      };

      // Required fields
      article.title = extractField("title") || "";
      article.slug = extractField("slug") || "";
      article.metaDescription = extractField("metaDescription") || "";
      article.keywords = extractArray("keywords") || [];
      article.markdown = extractField("markdown") || "";
      article.html = extractField("html") || "";
      article.schemaOrg = extractObject("schemaOrg") || {};
      article.openGraph = extractObject("openGraph") || {};

      // Optional fields
      const socialMediaMatch = jsonString.match(/"socialMedia"\s*:\s*(\{[\s\S]*?\})\s*,?\s*"showNotes"/);
      if (socialMediaMatch) {
        try {
          article.socialMedia = JSON.parse(socialMediaMatch[1]);
        } catch {
          logger.warn("[JSON Parser] Could not parse socialMedia, skipping...");
        }
      }

      const showNotesMatch = jsonString.match(/"showNotes"\s*:\s*(\{[\s\S]*?\})\s*\}/);
      if (showNotesMatch) {
        try {
          article.showNotes = JSON.parse(showNotesMatch[1]);
        } catch {
          logger.warn("[JSON Parser] Could not parse showNotes, skipping...");
        }
      }

      return article as BlogArticle;
    }
  ];

  // Try each strategy in order
  let lastError: any;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (i > 0) {
        logger.info(`[JSON Parser] ✅ Successfully parsed with strategy ${i + 1}`);
      }
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
    logger.info("=".repeat(80));
    logger.info("[Vertex AI] Starting audio processing with Vertex AI");

    // Initialize Vertex AI client if not already done
    if (!vertexAI) {
      logger.info("[Vertex AI] Initializing Vertex AI client...");
      try {
        const projectId = config.projectId;
        const location = config.region; // europe-west1 or europe-west3

        vertexAI = new VertexAI({
          project: projectId,
          location: location,
        });

        const regionInfo = config.region === "europe-west3"
          ? "🇩🇪 Germany (Frankfurt)"
          : "🇪🇺 EU (Belgium)";

        logger.info("[Vertex AI] ✅ Vertex AI client initialized successfully", {
          project: projectId,
          location: location,
          dataResidency: regionInfo,
          endpoint: `https://${location}-aiplatform.googleapis.com`,
        });
      } catch (error: any) {
        logger.error("[Vertex AI] ❌ Failed to initialize Vertex AI client:", {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }

    // Get generative model
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    // Construct Cloud Storage URI
    const bucketName = admin.storage().bucket().name;
    const gsUri = `gs://${bucketName}/${storagePath}`;

    logger.info("[Vertex AI] Sending audio to Vertex AI API...", {
      storagePath,
      gsUri,
      mimeType,
      model: "gemini-2.5-flash",
      region: config.region,
      bucketName,
    });

    // Prepare request with Cloud Storage URI
    const filePart = {
      file_data: {
        file_uri: gsUri,
        mime_type: mimeType,
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
    const text = response.text();

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

    logger.info("[Vertex AI] ✅ API call completed", {
      durationMs: duration,
      durationSeconds: (duration / 1000).toFixed(2),
      promptTokens,
      responseTokens,
      totalTokens,
      estimatedCostUSD: `$${estimatedCost.toFixed(4)}`,
      region: config.region,
    });

    logger.info("[Vertex AI] ✅ Received response from Vertex AI", {
      responseLength: text.length,
      responseLengthKB: (text.length / 1024).toFixed(2),
    });

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

    // Validate required fields
    if (!article.title || !article.markdown || !article.html) {
      throw new Error("Missing required fields in Vertex AI response");
    }

    // Log additional info
    const hasSocialMedia = !!article.socialMedia;
    const hasShowNotes = !!article.showNotes;

    logger.info("[Vertex AI] ✅ Successfully parsed article:", {
      title: article.title,
      wordCount: article.markdown.split(/\s+/).length,
      hasSocialMedia,
      hasShowNotes,
      socialMediaPlatforms: hasSocialMedia
        ? Object.keys(article.socialMedia || {}).length
        : 0,
      showNotesChapters: hasShowNotes ? article.showNotes?.chapters.length : 0,
      showNotesQuotes: hasShowNotes ? article.showNotes?.quotes.length : 0,
    });
    logger.info("=".repeat(80));

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
