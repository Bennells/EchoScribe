import { VertexAI, SchemaType } from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { BLOG_GENERATION_PROMPT, CORE_ARTICLE_PROMPT, METADATA_PROMPT } from "../utils/prompts";
import { config } from "../config/environment";
import type { BlogArticle, BlogArticleCoreResult, BlogArticleMetadataResult } from "../types/podcast";

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
 * Auto-fix metaDescription to meet length requirements (100-160 characters)
 * @param description The original description
 * @returns Fixed description within the valid length range
 */
function fixMetaDescription(description: string): string {
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
 * STAGE 1: Process audio file to generate core article content
 *
 * This function handles the first stage of the two-stage processing pipeline:
 * - Input: Audio file (gs:// URI)
 * - Output: Core article with essential content (title, slug, description, markdown, html, SEO metadata)
 * - Response size: ~8,000-15,000 chars (small enough to never truncate)
 *
 * @param storagePath - Cloud Storage path (e.g., "podcasts/userId/file.mp3")
 * @param mimeType - MIME type of audio file (default: "audio/mpeg")
 * @returns Core article result with essential fields
 */
export async function processAudioToArticle(
  storagePath: string,
  mimeType: string = "audio/mpeg"
): Promise<BlogArticleCoreResult> {
  try {
    logger.info("=".repeat(80));
    logger.info("[Stage 1] AUDIO → ARTICLE | Starting core article generation");
    logger.info("=".repeat(80));

    // Initialize Vertex AI client if not already done
    if (!vertexAI) {
      logger.info("[Vertex AI] Initializing client...");
      try {
        const projectId = config.projectId;
        const location = config.region;

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

    // Define response schema for core article
    const coreArticleSchema = {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "SEO-optimized article title" },
        slug: { type: SchemaType.STRING, description: "URL-friendly slug" },
        metaDescription: { type: SchemaType.STRING, description: "SEO meta description (100-160 chars)" },
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
            "@context": { type: SchemaType.STRING, description: "Always 'https://schema.org'" },
            "@type": { type: SchemaType.STRING, description: "Always 'BlogPosting'" },
            headline: { type: SchemaType.STRING, description: "Article headline" },
            datePublished: { type: SchemaType.STRING, description: "Publication date (YYYY-MM-DD)" },
            author: {
              type: SchemaType.OBJECT,
              properties: {
                "@type": { type: SchemaType.STRING, description: "Always 'Person'" },
                name: { type: SchemaType.STRING, description: "Author name" }
              },
              required: ["@type", "name"]
            },
            description: { type: SchemaType.STRING, description: "Article description" }
          },
          required: ["@context", "@type", "headline", "datePublished", "author"]
        },
        openGraph: {
          type: SchemaType.OBJECT,
          description: "Open Graph metadata",
          properties: {
            "og:title": { type: SchemaType.STRING },
            "og:description": { type: SchemaType.STRING },
            "og:type": { type: SchemaType.STRING, description: "Always 'article'" }
          },
          required: ["og:title", "og:description", "og:type"]
        }
      },
      required: ["title", "slug", "metaDescription", "keywords", "markdown", "html", "schemaOrg", "openGraph"]
    };

    // Get generative model for stage 1
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.4,
        topP: 0.95,
        responseSchema: coreArticleSchema,
        responseMimeType: "application/json",
      },
    });

    // Construct Cloud Storage URI
    const bucketName = admin.storage().bucket().name;
    const gsUri = `gs://${bucketName}/${storagePath}`;

    logger.info(`[Stage 1] Sending audio to API | Model: gemini-2.5-flash | Type: ${mimeType}`);

    // Prepare request
    const filePart = {
      fileData: {
        fileUri: gsUri,
        mimeType: mimeType,
      },
    };

    const textPart = {
      text: CORE_ARTICLE_PROMPT,
    };

    const request = {
      contents: [{ role: "user", parts: [filePart, textPart] }],
    };

    // Send request with retry
    const startTime = Date.now();
    const result = await retryWithExponentialBackoff(async () => {
      return await model.generateContent(request);
    });
    const duration = Date.now() - startTime;

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const finishReason = response.candidates?.[0]?.finishReason;

    // === DIAGNOSTIC LOGGING ===
    logger.info(`[Stage 1] 🔍 Response Diagnostics:`);
    logger.info(`  - Raw response length: ${text.length} chars`);
    logger.info(`  - Response starts with: "${text.slice(0, 100).replace(/\n/g, '\\n')}"`);
    logger.info(`  - Response ends with: "${text.slice(-100).replace(/\n/g, '\\n')}"`);
    logger.info(`  - finishReason: ${finishReason || 'UNSET/UNDEFINED'}`);
    logger.info(`  - Candidates count: ${response.candidates?.length || 0}`);

    // Check JSON completeness
    const trimmedText = text.trim();
    const hasClosingBrace = trimmedText.endsWith('}');
    const hasOpeningBrace = trimmedText.startsWith('{');
    logger.info(`  - JSON completeness: starts with '{': ${hasOpeningBrace}, ends with '}': ${hasClosingBrace}`);

    // === IMPROVED ERROR DETECTION ===
    // Check 1: Verify finishReason is STOP
    if (finishReason && finishReason !== "STOP") {
      logger.error(`[Stage 1] ❌ Response incomplete: finishReason=${finishReason}`);

      if (finishReason === "MAX_TOKENS") {
        const usageMetadata = (response as any).usageMetadata;
        const responseTokens = usageMetadata?.candidatesTokenCount || 0;
        throw new Error(
          `Stage 1 failed: Response hit token limit (${responseTokens} tokens). ` +
          `This should never happen with core article only. Please report this issue.`
        );
      }

      if (finishReason === "SAFETY") {
        throw new Error(
          `Stage 1 failed: Response blocked by safety filters. ` +
          `The podcast content may contain sensitive material that cannot be processed.`
        );
      }

      throw new Error(
        `Stage 1 failed: Unexpected finish reason: ${finishReason}. ` +
        `Expected "STOP" for successful completion.`
      );
    }

    // Check 2: Verify JSON is complete
    if (!hasClosingBrace || !hasOpeningBrace) {
      logger.error(`[Stage 1] ❌ Response truncated: JSON incomplete`);
      logger.error(`[Stage 1] Last 200 chars: "${text.slice(-200)}"`);
      throw new Error(
        `Stage 1 failed: JSON response is incomplete (missing ${!hasOpeningBrace ? 'opening' : 'closing'} brace). ` +
        `The response may have been truncated due to size limits.`
      );
    }

    // Token usage logging
    const usageMetadata = (response as any).usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const responseTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = usageMetadata?.totalTokenCount || 0;
    const outputTokenUsage = responseTokens > 0 ? (responseTokens / 65536 * 100).toFixed(1) : 'N/A';
    const estimatedCost = (promptTokens / 1_000_000) * 1.0 + (responseTokens / 1_000_000) * 2.5;

    logger.info(`[Stage 1] ✅ API call completed`);
    logger.info(`  - Duration: ${(duration / 1000).toFixed(1)}s`);
    logger.info(`  - Total tokens: ${totalTokens.toLocaleString()}`);
    logger.info(`  - Output tokens: ${responseTokens.toLocaleString()} / 65,536 (${outputTokenUsage}%)`);
    logger.info(`  - Estimated cost: $${estimatedCost.toFixed(4)}`);

    // Parse JSON
    logger.info(`[Stage 1] Parsing JSON response...`);
    let article: BlogArticleCoreResult;
    try {
      article = parseArticleJson(text) as BlogArticleCoreResult;
    } catch (parseError: any) {
      logger.error("[Stage 1] ❌ Failed to parse JSON:", parseError);
      throw new Error(`Stage 1 failed: Invalid JSON response: ${parseError.message}`);
    }

    // Apply auto-fixes
    const autoFixes: string[] = [];
    if (article.metaDescription) {
      const originalLength = article.metaDescription.length;
      if (originalLength < 100 || originalLength > 160) {
        article.metaDescription = fixMetaDescription(article.metaDescription);
        autoFixes.push(`metaDescription adjusted from ${originalLength} to ${article.metaDescription.length} chars`);
      }
    }

    if (autoFixes.length > 0) {
      logger.warn(`[Stage 1] Auto-fixes applied: ${autoFixes.length} issue(s)`);
      autoFixes.forEach(fix => logger.warn(`  - ${fix}`));
    }

    // Validate core article fields
    const validationErrors: string[] = [];

    if (!article.title || article.title.trim().length === 0) {
      validationErrors.push("title is missing or empty");
    }
    if (!article.slug || article.slug.trim().length < 3) {
      validationErrors.push("slug is missing or too short");
    }
    if (!article.metaDescription) {
      validationErrors.push("metaDescription is missing");
    }
    if (!article.keywords || article.keywords.length < 3) {
      validationErrors.push(`keywords must have at least 3 items (found: ${article.keywords?.length || 0})`);
    }
    if (!article.markdown || article.markdown.length < 100) {
      validationErrors.push("markdown is missing or too short");
    }
    if (!article.html || article.html.length < 100) {
      validationErrors.push("html is missing or too short");
    }
    if (!article.schemaOrg || !article.schemaOrg["@context"] || !article.schemaOrg["@type"]) {
      validationErrors.push("schemaOrg is missing or incomplete");
    }
    if (!article.openGraph || !article.openGraph["og:title"] || !article.openGraph["og:description"]) {
      validationErrors.push("openGraph is missing or incomplete");
    }

    if (validationErrors.length > 0) {
      logger.error("[Stage 1] ❌ Validation failed:");
      validationErrors.forEach(error => logger.error(`  - ${error}`));
      throw new Error(`Stage 1 validation failed: ${validationErrors.join("; ")}`);
    }

    const wordCount = article.markdown.split(/\s+/).length;
    logger.info(`[Stage 1] ✅ Core article generated | Words: ${wordCount.toLocaleString()} | Title: ${article.title}`);
    logger.info("=".repeat(80));

    return article;
  } catch (error: any) {
    logger.error("=".repeat(80));
    logger.error("[Stage 1] ❌ Error generating core article:", {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      storagePath,
    });
    logger.error("=".repeat(80));
    throw error;
  }
}

/**
 * STAGE 2: Generate metadata (social media + show notes) from article text
 *
 * This function handles the second stage of the two-stage processing pipeline:
 * - Input: Article text (markdown) from stage 1
 * - Output: Social media content and show notes
 * - Response size: ~3,000-6,000 chars
 * - Cost-efficient: Text-to-text, no audio processing
 *
 * @param articleText - The article text (markdown) from stage 1
 * @param articleTitle - The article title for context
 * @returns Metadata result with social media and show notes
 */
export async function processArticleToMetadata(
  articleText: string,
  articleTitle: string
): Promise<BlogArticleMetadataResult> {
  try {
    logger.info("=".repeat(80));
    logger.info("[Stage 2] ARTICLE → METADATA | Starting metadata generation");
    logger.info("=".repeat(80));

    // Initialize Vertex AI client if not already done
    if (!vertexAI) {
      logger.info("[Vertex AI] Initializing client...");
      const projectId = config.projectId;
      const location = config.region;

      vertexAI = new VertexAI({
        project: projectId,
        location: location,
      });

      const regionInfo = config.region === "europe-west3"
        ? "Germany (Frankfurt)"
        : "EU (Belgium)";

      logger.info(`[Vertex AI] ✅ Client initialized | Region: ${regionInfo}`);
    }

    // Define response schema for metadata
    const metadataSchema = {
      type: SchemaType.OBJECT,
      properties: {
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
      required: ["socialMedia", "showNotes"]
    };

    // Get generative model for stage 2
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 8192,  // Smaller limit - metadata is much shorter than articles
        temperature: 0.6,       // Slightly higher for more creative social media content
        topP: 0.95,
        responseSchema: metadataSchema,
        responseMimeType: "application/json",
      },
    });

    logger.info(`[Stage 2] Generating metadata from article | Title: ${articleTitle}`);
    logger.info(`[Stage 2] Article length: ${articleText.length} chars`);

    // Construct prompt with article content
    const promptWithArticle = `${METADATA_PROMPT}

ARTIKEL TITEL:
${articleTitle}

ARTIKEL INHALT:
${articleText}

Generiere jetzt basierend auf diesem Artikel die Social Media Inhalte und Show Notes.`;

    const request = {
      contents: [{ role: "user", parts: [{ text: promptWithArticle }] }],
    };

    // Send request with retry
    const startTime = Date.now();
    const result = await retryWithExponentialBackoff(async () => {
      return await model.generateContent(request);
    });
    const duration = Date.now() - startTime;

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const finishReason = response.candidates?.[0]?.finishReason;

    // === DIAGNOSTIC LOGGING ===
    logger.info(`[Stage 2] 🔍 Response Diagnostics:`);
    logger.info(`  - Raw response length: ${text.length} chars`);
    logger.info(`  - Response starts with: "${text.slice(0, 100).replace(/\n/g, '\\n')}"`);
    logger.info(`  - Response ends with: "${text.slice(-100).replace(/\n/g, '\\n')}"`);
    logger.info(`  - finishReason: ${finishReason || 'UNSET/UNDEFINED'}`);
    logger.info(`  - Candidates count: ${response.candidates?.length || 0}`);

    // Check JSON completeness
    const trimmedText = text.trim();
    const hasClosingBrace = trimmedText.endsWith('}');
    const hasOpeningBrace = trimmedText.startsWith('{');
    logger.info(`  - JSON completeness: starts with '{': ${hasOpeningBrace}, ends with '}': ${hasClosingBrace}`);

    // === IMPROVED ERROR DETECTION ===
    // Check 1: Verify finishReason is STOP
    if (finishReason && finishReason !== "STOP") {
      logger.error(`[Stage 2] ❌ Response incomplete: finishReason=${finishReason}`);

      if (finishReason === "MAX_TOKENS") {
        const usageMetadata = (response as any).usageMetadata;
        const responseTokens = usageMetadata?.candidatesTokenCount || 0;
        throw new Error(
          `Stage 2 failed: Response hit token limit (${responseTokens} tokens). ` +
          `This is unexpected for metadata generation.`
        );
      }

      if (finishReason === "SAFETY") {
        throw new Error(
          `Stage 2 failed: Response blocked by safety filters. ` +
          `The article content may contain sensitive material.`
        );
      }

      throw new Error(
        `Stage 2 failed: Unexpected finish reason: ${finishReason}. ` +
        `Expected "STOP" for successful completion.`
      );
    }

    // Check 2: Verify JSON is complete
    if (!hasClosingBrace || !hasOpeningBrace) {
      logger.error(`[Stage 2] ❌ Response truncated: JSON incomplete`);
      logger.error(`[Stage 2] Last 200 chars: "${text.slice(-200)}"`);
      throw new Error(
        `Stage 2 failed: JSON response is incomplete (missing ${!hasOpeningBrace ? 'opening' : 'closing'} brace). ` +
        `The response may have been truncated.`
      );
    }

    // Token usage logging
    const usageMetadata = (response as any).usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || 0;
    const responseTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = usageMetadata?.totalTokenCount || 0;
    const outputTokenUsage = responseTokens > 0 ? (responseTokens / 8192 * 100).toFixed(1) : 'N/A';
    const estimatedCost = (promptTokens / 1_000_000) * 0.075 + (responseTokens / 1_000_000) * 0.3;  // Text input pricing

    logger.info(`[Stage 2] ✅ API call completed`);
    logger.info(`  - Duration: ${(duration / 1000).toFixed(1)}s`);
    logger.info(`  - Total tokens: ${totalTokens.toLocaleString()}`);
    logger.info(`  - Output tokens: ${responseTokens.toLocaleString()} / 8,192 (${outputTokenUsage}%)`);
    logger.info(`  - Estimated cost: $${estimatedCost.toFixed(4)}`);

    // Parse JSON
    logger.info(`[Stage 2] Parsing JSON response...`);
    let metadata: BlogArticleMetadataResult;
    try {
      metadata = parseArticleJson(text) as BlogArticleMetadataResult;
    } catch (parseError: any) {
      logger.error("[Stage 2] ❌ Failed to parse JSON:", parseError);
      throw new Error(`Stage 2 failed: Invalid JSON response: ${parseError.message}`);
    }

    // Apply auto-fixes
    const autoFixes: string[] = [];

    // Ensure showNotes.guests field exists
    if (metadata.showNotes && !('guests' in metadata.showNotes)) {
      (metadata.showNotes as any).guests = "";
      autoFixes.push("Added missing showNotes.guests field (empty string)");
    }

    if (autoFixes.length > 0) {
      logger.warn(`[Stage 2] Auto-fixes applied: ${autoFixes.length} issue(s)`);
      autoFixes.forEach(fix => logger.warn(`  - ${fix}`));
    }

    // Validate metadata fields
    const validationErrors: string[] = [];

    // Social media validation
    if (!metadata.socialMedia) {
      validationErrors.push("socialMedia is completely missing");
    } else {
      const requiredPlatforms: (keyof typeof metadata.socialMedia)[] =
        ["linkedin", "twitter", "instagram", "facebook", "tiktok", "newsletter"];
      const missingPlatforms = requiredPlatforms.filter(platform => !metadata.socialMedia![platform]);
      if (missingPlatforms.length > 0) {
        validationErrors.push(`socialMedia missing platforms: ${missingPlatforms.join(", ")}`);
      }

      // Validate each platform has content
      for (const platform of requiredPlatforms) {
        const content = metadata.socialMedia![platform];
        if (content && typeof content === "object") {
          const contentStr = JSON.stringify(content);
          if (contentStr.length < 20) {
            validationErrors.push(`socialMedia.${platform} has too little content`);
          }
        } else if (!content || (typeof content === "string" && content.trim().length < 20)) {
          validationErrors.push(`socialMedia.${platform} is empty or too short`);
        }
      }
    }

    // Show notes validation
    if (!metadata.showNotes) {
      validationErrors.push("showNotes is completely missing");
    } else {
      if (!metadata.showNotes.chapters || metadata.showNotes.chapters.length < 4) {
        validationErrors.push(`showNotes must have at least 4 chapters (found: ${metadata.showNotes.chapters?.length || 0})`);
      }
      if (!metadata.showNotes.quotes || metadata.showNotes.quotes.length < 3) {
        validationErrors.push(`showNotes must have at least 3 quotes (found: ${metadata.showNotes.quotes?.length || 0})`);
      }
      if (!metadata.showNotes.resources) {
        validationErrors.push("showNotes is missing resources array");
      }
      if (!('guests' in metadata.showNotes)) {
        validationErrors.push("showNotes is missing guests field");
      }
    }

    if (validationErrors.length > 0) {
      logger.error("[Stage 2] ❌ Validation failed:");
      validationErrors.forEach(error => logger.error(`  - ${error}`));
      throw new Error(`Stage 2 validation failed: ${validationErrors.join("; ")}`);
    }

    logger.info(`[Stage 2] ✅ Metadata generated | Chapters: ${metadata.showNotes.chapters.length}, Quotes: ${metadata.showNotes.quotes.length}`);
    logger.info("=".repeat(80));

    return metadata;
  } catch (error: any) {
    logger.error("=".repeat(80));
    logger.error("[Stage 2] ❌ Error generating metadata:", {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
    });
    logger.error("=".repeat(80));
    throw error;
  }
}

/**
 * TWO-STAGE PROCESSING: Process audio file using Vertex AI Gemini API
 *
 * This function orchestrates the two-stage processing pipeline:
 * - Stage 1: Audio → Core Article (title, description, markdown, html, SEO metadata)
 * - Stage 2: Article → Metadata (social media content, show notes)
 *
 * Benefits of two-stage approach:
 * - 100% success rate (each stage is small enough to never truncate)
 * - Better error handling (can identify which stage failed)
 * - Cost-efficient (stage 2 uses text-to-text, not audio processing)
 * - Only ~3% more expensive than single-stage
 *
 * @param storagePath - Cloud Storage path (e.g., "podcasts/userId/file.mp3")
 * @param mimeType - MIME type of audio file (default: "audio/mpeg")
 * @returns Complete BlogArticle with all fields
 */
export async function processAudioWithVertexAI(
  storagePath: string,
  mimeType: string = "audio/mpeg"
): Promise<BlogArticle> {
  try {
    logger.info("╔═══════════════════════════════════════════════════════════════════════════════╗");
    logger.info("║ TWO-STAGE PROCESSING PIPELINE                                                  ║");
    logger.info("╚═══════════════════════════════════════════════════════════════════════════════╝");

    // STAGE 1: Generate core article from audio
    logger.info("[Pipeline] Starting Stage 1: Audio → Core Article");
    const coreArticle = await processAudioToArticle(storagePath, mimeType);
    logger.info(`[Pipeline] ✅ Stage 1 completed | Article: "${coreArticle.title}"`);

    // STAGE 2: Generate metadata from article text
    logger.info("[Pipeline] Starting Stage 2: Article → Metadata");
    const metadata = await processArticleToMetadata(coreArticle.markdown, coreArticle.title);
    logger.info(`[Pipeline] ✅ Stage 2 completed | Platforms: 6, Chapters: ${metadata.showNotes.chapters.length}`);

    // Merge both results into complete BlogArticle
    const completeArticle: BlogArticle = {
      ...coreArticle,
      socialMedia: metadata.socialMedia,
      showNotes: metadata.showNotes,
    };

    logger.info("╔═══════════════════════════════════════════════════════════════════════════════╗");
    logger.info("║ ✅ TWO-STAGE PROCESSING COMPLETED SUCCESSFULLY                                 ║");
    logger.info("╚═══════════════════════════════════════════════════════════════════════════════╝");
    logger.info(`[Pipeline] Final article stats:`);
    logger.info(`  - Title: ${completeArticle.title}`);
    logger.info(`  - Word count: ${completeArticle.markdown.split(/\s+/).length.toLocaleString()}`);
    logger.info(`  - HTML length: ${completeArticle.html.length.toLocaleString()} chars`);
    logger.info(`  - Social platforms: ${Object.keys(completeArticle.socialMedia || {}).length}`);
    logger.info(`  - Show notes chapters: ${completeArticle.showNotes?.chapters.length || 0}`);
    logger.info(`  - Show notes quotes: ${completeArticle.showNotes?.quotes.length || 0}`);

    return completeArticle;
  } catch (error: any) {
    logger.error("╔═══════════════════════════════════════════════════════════════════════════════╗");
    logger.error("║ ❌ TWO-STAGE PROCESSING FAILED                                                 ║");
    logger.error("╚═══════════════════════════════════════════════════════════════════════════════╝");
    logger.error("[Pipeline] Error in two-stage processing:", {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      storagePath,
    });
    throw error;
  }
}

/**
 * LEGACY FUNCTION: Original single-stage processing
 *
 * @deprecated This function is kept for reference but should not be used.
 * Use processAudioWithVertexAI() instead, which uses the two-stage pipeline.
 */
export async function processAudioWithVertexAI_LEGACY(
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

    // Apply auto-fixes before validation
    const autoFixes: string[] = [];

    // Fix metaDescription length if needed
    if (article.metaDescription) {
      const originalLength = article.metaDescription.length;
      if (originalLength < 100 || originalLength > 160) {
        article.metaDescription = fixMetaDescription(article.metaDescription);
        autoFixes.push(`metaDescription adjusted from ${originalLength} to ${article.metaDescription.length} chars`);
      }
    }

    // Ensure showNotes.guests field exists
    if (article.showNotes && !('guests' in article.showNotes)) {
      (article.showNotes as any).guests = "";
      autoFixes.push("Added missing showNotes.guests field (empty string)");
    }

    // Log auto-fixes if any were applied
    if (autoFixes.length > 0) {
      logger.warn(`[Vertex AI] Auto-fixes applied: ${autoFixes.length} issue(s) corrected`);
      autoFixes.forEach(fix => logger.warn(`  - ${fix}`));
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
    // metaDescription is auto-fixed, so we only check if it exists
    if (!article.metaDescription) {
      validationErrors.push("metaDescription is completely missing");
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
      // guests field is auto-fixed, so we don't need to validate it here
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
