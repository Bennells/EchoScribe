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
  const strategies = [
    // Strategy 1: Parse as-is
    () => JSON.parse(jsonString),

    // Strategy 2: Fix unescaped quotes in string values using state machine
    () => {
      logger.warn("[JSON Parser] Strategy 2: Escaping unescaped quotes in string values...");

      // Use a state machine to properly escape quotes within JSON string values
      const chars = jsonString.split('');
      const result: string[] = [];
      let inString = false;
      let afterColon = false;
      let depth = 0; // Track nesting depth in objects/arrays

      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const prevChar = i > 0 ? chars[i - 1] : '';

        // Track object/array depth for context
        if (!inString) {
          if (char === '{' || char === '[') depth++;
          if (char === '}' || char === ']') depth--;
          if (char === ':') {
            afterColon = true;
          }
        }

        // Handle quotes
        if (char === '"' && prevChar !== '\\') {
          if (!inString) {
            // Starting a string
            inString = true;
            result.push(char);
          } else {
            // We're in a string and found an unescaped quote
            // Check if this is the closing quote or an inner quote

            // Look ahead to see if this looks like the end of the value
            // The closing quote should be followed by: , } ] or whitespace then , } ]
            let j = i + 1;
            while (j < chars.length && /\s/.test(chars[j])) j++; // skip whitespace
            const charAfterWhitespace = j < chars.length ? chars[j] : '';

            const isClosingQuote = charAfterWhitespace === ',' ||
                                   charAfterWhitespace === '}' ||
                                   charAfterWhitespace === ']' ||
                                   charAfterWhitespace === '';

            if (isClosingQuote && afterColon) {
              // This is the closing quote of a value
              inString = false;
              afterColon = false;
              result.push(char);
            } else if (inString && afterColon) {
              // This is an unescaped quote inside a string value - escape it
              result.push('\\');
              result.push(char);
            } else {
              // This is a closing quote for a key (before :)
              inString = false;
              result.push(char);
            }
          }
        } else {
          result.push(char);
        }
      }

      const fixed = result.join('');
      logger.info(`[JSON Parser] Strategy 2 transformed ${jsonString.length} chars to ${fixed.length} chars`);
      return JSON.parse(fixed);
    },

    // Strategy 3: Fix invalid escape sequences
    () => {
      logger.warn("[JSON Parser] Strategy 3: Fixing escape sequences...");
      let fixed = jsonString.replace(/\\([^"\\\/bfnrtu])/g, "$1");
      return JSON.parse(fixed);
    },

    // Strategy 4: Aggressive quote escaping with broader pattern
    () => {
      logger.warn("[JSON Parser] Strategy 4: Aggressive quote fixing...");
      let fixed = jsonString;

      // More aggressive approach: find all string values and escape any unescaped quotes within them
      // This uses a state machine approach to properly handle nested structures
      const chars = fixed.split('');
      const result: string[] = [];
      let inString = false;
      let inValue = false;
      let prevChar = '';

      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const nextChar = i < chars.length - 1 ? chars[i + 1] : '';

        if (char === '"' && prevChar !== '\\') {
          if (!inString) {
            // Starting a string
            inString = true;
            // Check if this is a value (comes after : )
            const beforeQuote = result.slice(-10).join('').trim();
            inValue = beforeQuote.endsWith(':');
          } else {
            // Check if we're at the end of the string value
            // (next char should be ,}] or whitespace followed by ,}])
            const isEndOfString = !nextChar || /[,}\]\s]/.test(nextChar);

            if (isEndOfString) {
              // This is the closing quote of the string
              inString = false;
              inValue = false;
            } else if (inValue) {
              // We're in a value and this quote is not the closing quote
              // So it should be escaped
              result.push('\\');
            }
          }
        }

        result.push(char);
        prevChar = char === '\\' && prevChar === '\\' ? '' : char; // Handle double backslash
      }

      return JSON.parse(result.join(''));
    },

    // Strategy 5: Relaxed JSON5-style parsing with manual reconstruction
    () => {
      logger.warn("[JSON Parser] Strategy 5: Manual field extraction...");
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

      // Extract object fields with proper nested brace handling
      const extractObject = (fieldName: string): any | null => {
        const startRegex = new RegExp(`"${fieldName}"\\s*:\\s*\\{`, "s");
        const startMatch = startRegex.exec(jsonString);
        if (!startMatch) {
          logger.warn(`[JSON Parser] Field "${fieldName}" not found in JSON string`);
          return null;
        }

        logger.info(`[JSON Parser] Extracting object field: ${fieldName}`);

        // Count braces to find the matching closing brace
        let braceCount = 1;
        let i = startMatch.index + startMatch[0].length;
        let endIndex = -1;

        while (i < jsonString.length && braceCount > 0) {
          const char = jsonString[i];
          const prevChar = i > 0 ? jsonString[i - 1] : "";

          // Only count braces that aren't escaped
          if (char === "{" && prevChar !== "\\") {
            braceCount++;
          } else if (char === "}" && prevChar !== "\\") {
            braceCount--;
            if (braceCount === 0) {
              endIndex = i;
              break;
            }
          }
          i++;
        }

        if (endIndex === -1) {
          logger.warn(`[JSON Parser] Could not find closing brace for field: ${fieldName} (brace count never reached 0)`);
          return null;
        }

        const objectStr = jsonString.substring(
          startMatch.index + startMatch[0].indexOf("{"),
          endIndex + 1
        );

        logger.info(`[JSON Parser] Extracted ${fieldName} object (${objectStr.length} chars, ${endIndex - startMatch.index} from start)`);

        try {
          const parsed = JSON.parse(objectStr);
          logger.info(`[JSON Parser] ✅ Successfully parsed ${fieldName} with ${Object.keys(parsed).length} top-level keys`);
          return parsed;
        } catch (e: any) {
          logger.error(`[JSON Parser] ❌ Failed to parse object field ${fieldName}: ${e.message}`);
          logger.error(`[JSON Parser] Object string (first 500 chars): ${objectStr.substring(0, 500)}`);
          logger.error(`[JSON Parser] Object string (last 200 chars): ${objectStr.substring(Math.max(0, objectStr.length - 200))}`);
          return null;
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

      // Optional complex nested fields
      const socialMedia = extractObject("socialMedia");
      if (socialMedia) {
        article.socialMedia = socialMedia;
      } else {
        logger.warn("[JSON Parser] socialMedia field not found or invalid");
      }

      const showNotes = extractObject("showNotes");
      if (showNotes) {
        article.showNotes = showNotes;
      } else {
        logger.warn("[JSON Parser] showNotes field not found or invalid");
      }

      return article as BlogArticle;
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

    // Get generative model
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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
