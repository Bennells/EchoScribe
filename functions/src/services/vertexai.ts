import { VertexAI, SchemaType } from "@google-cloud/vertexai";
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
 * Parse JSON from Gemini response with responseSchema validation
 *
 * With responseSchema enabled, the Vertex AI API guarantees:
 * - Valid JSON structure matching the schema
 * - Proper escaping of special characters (quotes, umlauts, emojis)
 * - Type validation at the API level
 *
 * This eliminates the need for complex fallback parsing strategies.
 *
 * @param text Raw response text from Gemini
 * @returns Parsed BlogArticle object
 */
function parseArticleJson(text: string): BlogArticle {
  const cleanText = text.trim();

  // Log raw response for debugging
  logger.info(`[JSON Parser] Raw response length: ${text.length} chars`);
  logger.info(`[JSON Parser] First 200 chars: ${text.substring(0, 200)}`);
  logger.info(`[JSON Parser] Last 200 chars: ${text.substring(Math.max(0, text.length - 200))}`);

  // With responseSchema, the API returns clean JSON without code fences
  // Just parse directly - the schema enforces proper structure and escaping
  try {
    const article = JSON.parse(cleanText);
    logger.info("[JSON Parser] ✅ Successfully parsed JSON (responseSchema guarantees valid format)");
    return article;
  } catch (error: any) {
    // If parsing fails, log detailed diagnostics
    logger.error("[JSON Parser] ❌ Unexpected parsing failure despite responseSchema");
    logger.error(`[JSON Parser] Parse error: ${error.message}`);
    logger.error(`[JSON Parser] Error position: ${error.message.match(/position (\d+)/)?.[1] || 'unknown'}`);

    // Extract context around error position if available
    const posMatch = error.message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      const start = Math.max(0, pos - 100);
      const end = Math.min(cleanText.length, pos + 100);
      logger.error(`[JSON Parser] Context around error (pos ${pos}):`);
      logger.error(`[JSON Parser] "${cleanText.substring(start, end)}"`);
    }

    logger.error(`[JSON Parser] Full response (first 1000 chars): ${cleanText.substring(0, 1000)}`);
    logger.error(`[JSON Parser] Full response (last 500 chars): ${cleanText.substring(Math.max(0, cleanText.length - 500))}`);

    throw new Error(`Failed to parse Vertex AI JSON response (schema validation should prevent this): ${error.message}`);
  }
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

    // Get generative model with increased output token limit and strict JSON schema
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 65536,  // Full capacity - ensures complete responses for 3-4 hour podcasts
        temperature: 0.4,        // Lower temperature for consistent metadata generation
        topP: 0.95,             // Constrains output to high-probability tokens for better consistency
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING, description: "SEO-optimized article title" },
            slug: { type: SchemaType.STRING, description: "URL-friendly slug" },
            metaDescription: { type: SchemaType.STRING, description: "SEO meta description (150-160 chars)" },
            keywords: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Array of SEO keywords"
            },
            markdown: { type: SchemaType.STRING, description: "Full article in Markdown format" },
            html: { type: SchemaType.STRING, description: "Full article in HTML format" },
            schemaOrg: {
              type: SchemaType.OBJECT,
              description: "Schema.org structured data (BlogPosting)",
              properties: {
                "@context": {
                  type: SchemaType.STRING,
                  description: "Always 'https://schema.org'"
                },
                "@type": {
                  type: SchemaType.STRING,
                  description: "Always 'BlogPosting'"
                },
                headline: {
                  type: SchemaType.STRING,
                  description: "Article headline (same as title)"
                },
                datePublished: {
                  type: SchemaType.STRING,
                  description: "Publication date in ISO 8601 format (YYYY-MM-DD)"
                },
                author: {
                  type: SchemaType.OBJECT,
                  description: "Author information",
                  properties: {
                    "@type": {
                      type: SchemaType.STRING,
                      description: "Always 'Person'"
                    },
                    name: {
                      type: SchemaType.STRING,
                      description: "Author name from podcast"
                    }
                  },
                  required: ["@type", "name"]
                },
                description: {
                  type: SchemaType.STRING,
                  description: "Article description (same as metaDescription)"
                },
                image: {
                  type: SchemaType.STRING,
                  description: "Optional image URL"
                }
              },
              required: ["@context", "@type", "headline", "datePublished", "author"]
            },
            openGraph: {
              type: SchemaType.OBJECT,
              description: "Open Graph metadata for social sharing",
              properties: {
                "og:title": {
                  type: SchemaType.STRING,
                  description: "Article title for social sharing"
                },
                "og:description": {
                  type: SchemaType.STRING,
                  description: "Meta description for social sharing"
                },
                "og:type": {
                  type: SchemaType.STRING,
                  description: "Always 'article'"
                },
                "og:url": {
                  type: SchemaType.STRING,
                  description: "Optional article URL"
                },
                "og:image": {
                  type: SchemaType.STRING,
                  description: "Optional image URL for social preview"
                }
              },
              required: ["og:title", "og:description", "og:type"]
            },
            socialMedia: {
              type: SchemaType.OBJECT,
              properties: {
                linkedin: { type: SchemaType.STRING, description: "LinkedIn post content" },
                twitter: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: "Array of Twitter/X thread posts"
                },
                instagram: { type: SchemaType.STRING, description: "Instagram caption" },
                facebook: { type: SchemaType.STRING, description: "Facebook post" },
                tiktok: { type: SchemaType.STRING, description: "TikTok script/caption" },
                newsletter: { type: SchemaType.STRING, description: "Newsletter teaser" }
              },
              required: ["linkedin", "twitter", "instagram", "facebook", "tiktok", "newsletter"]
            },
            showNotes: {
              type: SchemaType.OBJECT,
              properties: {
                chapters: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      timestamp: { type: SchemaType.STRING },
                      title: { type: SchemaType.STRING },
                      description: { type: SchemaType.STRING }
                    },
                    required: ["timestamp", "title", "description"]
                  }
                },
                quotes: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                resources: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                guests: { type: SchemaType.STRING }
              },
              required: ["chapters", "quotes", "resources", "guests"]
            }
          },
          required: ["title", "slug", "metaDescription", "keywords", "markdown", "html", "schemaOrg", "openGraph", "socialMedia", "showNotes"]
        },
        responseMimeType: "application/json", // Combined with schema for guaranteed valid JSON with proper escaping
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

    // === DIAGNOSTIC LOGGING: Response Analysis ===
    logger.info(`[Vertex AI] 🔍 Response Diagnostics:`);
    logger.info(`  - Raw response length: ${text.length} chars`);
    logger.info(`  - Response starts with: "${text.slice(0, 100).replace(/\n/g, '\\n')}"`);
    logger.info(`  - Response ends with: "${text.slice(-100).replace(/\n/g, '\\n')}"`);

    const finishReason = response.candidates?.[0]?.finishReason;
    logger.info(`  - finishReason: ${finishReason || 'UNSET/UNDEFINED'}`);
    logger.info(`  - Candidates count: ${response.candidates?.length || 0}`);

    // Check JSON completeness
    const trimmedText = text.trim();
    const hasClosingBrace = trimmedText.endsWith('}');
    const hasOpeningBrace = trimmedText.startsWith('{');
    logger.info(`  - JSON completeness: starts with '{': ${hasOpeningBrace}, ends with '}': ${hasClosingBrace}`);

    if (!hasClosingBrace) {
      logger.error(`[Vertex AI] ⚠️ INCOMPLETE RESPONSE! Last 5 characters: "${text.slice(-5)}"`);
      logger.error(`[Vertex AI] Response appears to be truncated mid-JSON`);
    }

    // Check if response was truncated - throw error for MAX_TOKENS
    if (finishReason === "MAX_TOKENS") {
      // We need to get responseTokens from usageMetadata first
      const usageMetadata = (response as any).usageMetadata;
      const responseTokens = usageMetadata?.candidatesTokenCount || 0;
      const tokenUsagePercent = responseTokens > 0 ? (responseTokens / 65536 * 100).toFixed(1) : 'N/A';

      logger.error("[Vertex AI] ❌ Response hit token limit and was truncated!");
      logger.error(`[Vertex AI] Token usage: ${responseTokens.toLocaleString()} / 65,536 (${tokenUsagePercent}%)`);
      logger.error(`[Vertex AI] This should be extremely rare with temp=0.4 and 65k token limit`);

      throw new Error(
        `Response truncated due to token limit (maxOutputTokens: 65536, used: ${responseTokens}). ` +
        `Token usage: ${tokenUsagePercent}%. This is unexpected with full capacity and should only happen with ` +
        `exceptionally long podcasts (>4 hours) or unusual content. Please report this issue.`
      );
    }

    if (finishReason === "SAFETY") {
      logger.warn(`[Vertex AI] ⚠️ Response blocked by safety filters! Finish reason: ${finishReason}`);
    }
    // === END DIAGNOSTIC LOGGING ===

    // Extract token usage information
    const usageMetadata = (response as any).usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const responseTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = usageMetadata?.totalTokenCount || 0;

    // Calculate token efficiency metrics
    const maxOutputTokens = 65536;
    const outputTokenUsage = responseTokens > 0 ? (responseTokens / maxOutputTokens * 100).toFixed(1) : 'N/A';
    const tokenEfficiency = responseTokens > 60000 ? '⚠️ High' : responseTokens > 40000 ? '✓ Good' : '✓✓ Excellent';

    // Estimate costs (Gemini 2.5 Flash pricing: Audio $1.00/1M, Text $2.50/1M)
    const estimatedCost =
      totalTokens > 0
        ? (promptTokens / 1_000_000) * 1.0 + (responseTokens / 1_000_000) * 2.5
        : 0;

    logger.info(`[Vertex AI] ✅ API call completed`);
    logger.info(`  - Duration: ${(duration / 1000).toFixed(1)}s`);
    logger.info(`  - Total tokens: ${totalTokens.toLocaleString()}`);
    logger.info(`  - Output tokens: ${responseTokens.toLocaleString()} / ${maxOutputTokens.toLocaleString()} (${outputTokenUsage}%)`);
    logger.info(`  - Token efficiency: ${tokenEfficiency}`);
    logger.info(`  - Estimated cost: $${estimatedCost.toFixed(4)}`);
    logger.info(`  - Finish reason: ${finishReason}`);

    // Add warning if approaching token limit
    if (responseTokens > 60000) {
      logger.warn(`[Token Warning] Approaching output limit (${outputTokenUsage}% used) - consider prompt optimization for future improvements`);
    } else if (responseTokens > 50000) {
      logger.info(`[Token Stats] Healthy token usage with plenty of headroom (${outputTokenUsage}% of capacity)`);
    }

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
    if (!article.slug || article.slug.trim().length < 3) {
      validationErrors.push("slug is missing or too short (< 3 chars)");
    }
    if (!article.metaDescription || article.metaDescription.length < 100 || article.metaDescription.length > 160) {
      validationErrors.push(`metaDescription is invalid (${article.metaDescription?.length || 0} chars, should be 100-160)`);
    }
    if (!article.keywords || article.keywords.length < 3) {
      validationErrors.push(`keywords array must have at least 3 items (found: ${article.keywords?.length || 0})`);
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
      if (!article.schemaOrg.headline) {
        validationErrors.push("schemaOrg.headline is missing");
      }
      if (!article.schemaOrg.datePublished || !article.schemaOrg.datePublished.match(/^\d{4}-\d{2}-\d{2}$/)) {
        validationErrors.push(`schemaOrg.datePublished is invalid (${article.schemaOrg.datePublished || 'missing'}, should be YYYY-MM-DD)`);
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

    // Show notes validation
    if (!article.showNotes) {
      validationErrors.push("showNotes is completely missing");
    } else {
      if (!article.showNotes.chapters || article.showNotes.chapters.length < 4) {
        validationErrors.push(`showNotes must have at least 4 chapters (found: ${article.showNotes.chapters?.length || 0})`);
      }
      if (!article.showNotes.quotes || article.showNotes.quotes.length < 3) {
        validationErrors.push(`showNotes must have at least 3 quotes (found: ${article.showNotes.quotes?.length || 0})`);
      }
      if (!article.showNotes.resources) {
        validationErrors.push("showNotes is missing resources array");
      }
      if (!article.showNotes.guests) {
        validationErrors.push("showNotes is missing guests field");
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
