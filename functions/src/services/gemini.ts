import { GoogleGenerativeAI } from "@google/generative-ai";
import * as logger from "firebase-functions/logger";
import { BLOG_GENERATION_PROMPT } from "../utils/prompts";

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

function getApiKey(): string {
  // Firebase mounts secrets as environment variables in Cloud Run
  // So we can just use process.env for both deployed and local

  if (process.env.GEMINI_API_KEY) {
    const source = process.env.NODE_ENV === 'production'
      ? 'Secret Manager (via environment variable)'
      : 'local .env.local file';
    logger.info(`Using GEMINI_API_KEY from ${source}`);
    return process.env.GEMINI_API_KEY;
  }

  throw new Error("GEMINI_API_KEY not configured - please set up Secret Manager or .env.local");
}

let genAI: GoogleGenerativeAI;

export interface SocialMediaContent {
  linkedin: string;
  twitter: string[];
  instagram: string;
  facebook: string;
  tiktok: string;
  newsletter: string;
}

export interface ShowNotesChapter {
  timestamp: string;
  title: string;
  description: string;
}

export interface ShowNotes {
  chapters: ShowNotesChapter[];
  quotes: string[];
  resources: string[];
  guests: string;
}

export interface BlogArticle {
  title: string;
  slug: string;
  metaDescription: string;
  keywords: string[];
  markdown: string;
  html: string;
  schemaOrg: Record<string, any>;
  openGraph: Record<string, string>;
  socialMedia?: SocialMediaContent;
  showNotes?: ShowNotes;
}

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

export async function processAudioWithGemini(audioBuffer: Buffer): Promise<BlogArticle> {
  try {
    logger.info("=".repeat(80));
    logger.info("[Gemini] Starting audio processing with Gemini");

    // Initialize genAI if not already done
    if (!genAI) {
      logger.info("[Gemini] Initializing Gemini API client...");
      try {
        const apiKey = getApiKey();
        genAI = new GoogleGenerativeAI(apiKey);
        logger.info("[Gemini] ✅ Gemini API client initialized successfully");
      } catch (error: any) {
        logger.error("[Gemini] ❌ Failed to initialize Gemini API client:", {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    logger.info("[Gemini] Sending audio to Gemini API...", {
      audioSize: audioBuffer.length,
      audioSizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
      model: "gemini-2.5-flash",
    });

    // Send audio directly to Gemini with automatic retry on rate limits
    const startTime = Date.now();
    const result = await retryWithExponentialBackoff(async () => {
      return await model.generateContent([
        {
          inlineData: {
            mimeType: "audio/mp3",
            data: audioBuffer.toString("base64"),
          },
        },
        { text: BLOG_GENERATION_PROMPT },
      ]);
    });
    const duration = Date.now() - startTime;

    const response = result.response;
    const text = response.text();

    // Extract token usage information if available (check if property exists)
    const usageMetadata = (response as any).usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const responseTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = usageMetadata?.totalTokenCount || 0;

    // Estimate costs (as of Jan 2025, Gemini 2.5 Flash pricing)
    // Audio input: $1.00 per 1M tokens, Output: $2.50 per 1M tokens
    const estimatedCost = totalTokens > 0
      ? (promptTokens / 1_000_000) * 1.0 + (responseTokens / 1_000_000) * 2.5
      : 0;

    logger.info("[Gemini] ✅ API call completed", {
      durationMs: duration,
      durationSeconds: (duration / 1000).toFixed(2),
      promptTokens,
      responseTokens,
      totalTokens,
      estimatedCostUSD: `$${estimatedCost.toFixed(4)}`,
    });

    logger.info("[Gemini] ✅ Received response from Gemini", {
      responseLength: text.length,
      responseLengthKB: (text.length / 1024).toFixed(2),
    });

    // Parse JSON response with multiple strategies
    let article: BlogArticle;
    try {
      article = parseArticleJson(text);
    } catch (parseError: any) {
      logger.error("Failed to parse Gemini response as JSON:", parseError);
      logger.error("Response text (first 1000 chars):", text.substring(0, 1000));
      logger.error("Response text (last 500 chars):", text.substring(Math.max(0, text.length - 500)));
      throw new Error(`Invalid JSON response from Gemini: ${parseError.message}`);
    }

    // Validate required fields
    if (!article.title || !article.markdown || !article.html) {
      throw new Error("Missing required fields in Gemini response");
    }

    // Log additional info about new features
    const hasSocialMedia = !!article.socialMedia;
    const hasShowNotes = !!article.showNotes;

    logger.info("[Gemini] ✅ Successfully parsed article:", {
      title: article.title,
      wordCount: article.markdown.split(/\s+/).length,
      hasSocialMedia,
      hasShowNotes,
      socialMediaPlatforms: hasSocialMedia
        ? Object.keys(article.socialMedia || {}).length
        : 0,
      showNotesChapters: hasShowNotes
        ? article.showNotes?.chapters.length
        : 0,
      showNotesQuotes: hasShowNotes
        ? article.showNotes?.quotes.length
        : 0,
    });
    logger.info("=".repeat(80));

    return article;
  } catch (error: any) {
    logger.error("=".repeat(80));
    logger.error("[Gemini] ❌ Error processing audio with Gemini:", {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      errorStack: error.stack,
    });
    logger.error("=".repeat(80));
    throw error;
  }
}

export async function testGeminiConnection(): Promise<boolean> {
  try {
    // Initialize genAI if not already done
    if (!genAI) {
      const apiKey = getApiKey();
      genAI = new GoogleGenerativeAI(apiKey);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Hello, test");
    return !!result.response;
  } catch (error) {
    logger.error("Gemini connection test failed:", error);
    return false;
  }
}
