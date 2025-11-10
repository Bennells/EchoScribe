import { VertexAI, SchemaType } from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { AUDIO_ANALYSIS_PROMPT, METADATA_GENERATION_PROMPT } from "../utils/prompts";
import { config } from "../config/environment";
import type { BlogArticle, AudioAnalysisResult, MetadataResult } from "../types/podcast";
import { markdownToHtml, generateSlug } from "../utils/metadata-generator";

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
 * Two-Stage Audio Processing Pipeline
 *
 * Processes podcast audio in two optimized stages to prevent truncation:
 * - Stage 1: Audio Analysis → markdown article + show notes (requires audio access)
 * - Stage 2: Metadata Generation → SEO + social media content (text-only, no audio)
 * - App Generation: html + slug (computed client-side)
 *
 * Benefits:
 * - Lower token load per stage (prevents Flash model truncation)
 * - Cost-optimized (Stage 2 is cheaper, no audio processing)
 * - Proven reliability (based on previous 100% success rate two-stage implementation)
 *
 * @param storagePath - Cloud Storage path (e.g., "podcasts/userId/file.mp3")
 * @param mimeType - MIME type of audio file (default: "audio/mpeg")
 * @returns Complete BlogArticle with all metadata
 */
export async function processAudioTwoStage(
  storagePath: string,
  mimeType: string = "audio/mpeg"
): Promise<BlogArticle> {
  try {
    logger.info("=".repeat(80));
    logger.info("[Two-Stage Pipeline] Starting audio processing");
    logger.info("=".repeat(80));

    // Initialize Vertex AI client if not already done
    if (!vertexAI) {
      logger.info("[Vertex AI] Initializing client...");
      try {
        const projectId = config.projectId;
        const location = config.region;

        logger.info(`[Vertex AI] Config check: projectId=${projectId}, location=${location}`);

        if (!projectId) {
          throw new Error("Vertex AI initialization failed: projectId is undefined. Check GCLOUD_PROJECT environment variable.");
        }
        if (!location) {
          throw new Error("Vertex AI initialization failed: location/region is undefined. Check FIREBASE_CONFIG environment variable.");
        }

        vertexAI = new VertexAI({
          project: projectId,
          location: location,
        });

        const regionInfo = config.region === "europe-west3"
          ? "Germany (Frankfurt)"
          : "EU (Belgium)";

        logger.info(`[Vertex AI] ✅ Client initialized | Region: ${regionInfo} | Endpoint: ${location}-aiplatform.googleapis.com`);
      } catch (error: any) {
        logger.error("[Vertex AI] ❌ Failed to initialize client:");
        logger.error(`  - Error message: ${error?.message || '(no message)'}`);
        logger.error(`  - Error type: ${error?.constructor?.name || 'Unknown'}`);
        logger.error(`  - Error code: ${error?.code || '(no code)'}`);
        logger.error(`  - Stack: ${error?.stack || '(no stack)'}`);
        throw error;
      }
    }

    // Construct Cloud Storage URI
    const bucketName = admin.storage().bucket().name;
    const gsUri = `gs://${bucketName}/${storagePath}`;

    logger.info(`[Two-Stage Pipeline] Audio URI: ${gsUri}`);
    logger.info(`[Two-Stage Pipeline] MIME type: ${mimeType}`);

    // ========================================
    // STAGE 1: Audio Analysis (Audio → Article Only)
    // ========================================
    logger.info("\n" + "=".repeat(80));
    logger.info("[Stage 1] AUDIO ANALYSIS | Extracting SEO teaser article from audio");
    logger.info("=".repeat(80));

    const audioAnalysisSchema = {
      type: SchemaType.OBJECT,
      properties: {
        markdown: {
          type: SchemaType.STRING,
          description: "Complete SEO-optimized teaser article in Markdown format"
        }
      },
      required: ["markdown"]
    };

    const stage1Model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.4,
        topP: 0.95,
        responseSchema: audioAnalysisSchema,
        responseMimeType: "application/json",
      },
    });

    const stage1Request = {
      contents: [{
        role: "user",
        parts: [
          {
            fileData: {
              fileUri: gsUri,
              mimeType: mimeType,
            },
          },
          {
            text: AUDIO_ANALYSIS_PROMPT,
          },
        ],
      }],
    };

    logger.info("[Stage 1] Sending audio to Gemini Flash...");
    const stage1StartTime = Date.now();

    const stage1Result = await retryWithExponentialBackoff(async () => {
      return await stage1Model.generateContent(stage1Request);
    });

    const stage1Duration = ((Date.now() - stage1StartTime) / 1000).toFixed(2);
    logger.info(`[Stage 1] ⏱️ Completed in ${stage1Duration}s`);

    // Extract and parse Stage 1 response
    const stage1Response = stage1Result.response;
    const stage1Candidates = stage1Response.candidates;

    if (!stage1Candidates || stage1Candidates.length === 0) {
      throw new Error("[Stage 1] No candidates in response");
    }

    // Concatenate all parts to handle multi-part responses
    let stage1Text = "";
    for (const candidate of stage1Candidates) {
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            stage1Text += part.text;
          }
        }
      }
    }

    if (!stage1Text) {
      throw new Error("[Stage 1] No text content in response");
    }

    logger.info(`[Stage 1] Response length: ${stage1Text.length} characters`);

    // Parse Stage 1 JSON
    let audioAnalysis: AudioAnalysisResult;
    try {
      audioAnalysis = JSON.parse(stage1Text.trim());
      logger.info("[Stage 1] ✅ Successfully parsed audio analysis");
      logger.info(`[Stage 1] Markdown length: ${audioAnalysis.markdown?.length || 0} chars`);
    } catch (error: any) {
      logger.error("[Stage 1] ❌ Failed to parse JSON:", error.message);
      logger.error(`[Stage 1] First 500 chars: ${stage1Text.substring(0, 500)}`);
      logger.error(`[Stage 1] Last 500 chars: ${stage1Text.substring(Math.max(0, stage1Text.length - 500))}`);
      throw new Error(`Stage 1 JSON parsing failed: ${error.message}`);
    }

    // ========================================
    // STAGE 2: Metadata Generation (Article → SEO + Social)
    // ========================================
    logger.info("\n" + "=".repeat(80));
    logger.info("[Stage 2] METADATA GENERATION | Creating SEO + social media content");
    logger.info("=".repeat(80));

    const metadataSchema = {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: "SEO-optimized title (max 60 chars)"
        },
        metaDescription: {
          type: SchemaType.STRING,
          description: "SEO meta description (100-160 chars)"
        },
        keywords: {
          type: SchemaType.ARRAY,
          description: "Array of 5+ SEO keywords",
          items: { type: SchemaType.STRING }
        },
        schemaOrg: {
          type: SchemaType.OBJECT,
          description: "Schema.org BlogPosting structured data",
          properties: {
            "@context": { type: SchemaType.STRING },
            "@type": { type: SchemaType.STRING },
            headline: { type: SchemaType.STRING },
            datePublished: { type: SchemaType.STRING },
            author: {
              type: SchemaType.OBJECT,
              properties: {
                "@type": { type: SchemaType.STRING },
                name: { type: SchemaType.STRING }
              },
              required: ["@type", "name"]
            },
            description: { type: SchemaType.STRING }
          },
          required: ["@context", "@type", "headline", "datePublished", "author", "description"]
        },
        openGraph: {
          type: SchemaType.OBJECT,
          description: "Open Graph metadata",
          properties: {
            "og:title": { type: SchemaType.STRING },
            "og:description": { type: SchemaType.STRING },
            "og:type": { type: SchemaType.STRING }
          },
          required: ["og:title", "og:description", "og:type"]
        },
        socialMedia: {
          type: SchemaType.OBJECT,
          description: "Social media posts for all platforms",
          properties: {
            linkedin: { type: SchemaType.STRING },
            twitter: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Array of exactly 4 tweets"
            },
            instagram: { type: SchemaType.STRING },
            facebook: { type: SchemaType.STRING },
            tiktok: { type: SchemaType.STRING },
            newsletter: { type: SchemaType.STRING }
          },
          required: ["linkedin", "twitter", "instagram", "facebook", "tiktok", "newsletter"]
        }
      },
      required: ["title", "metaDescription", "keywords", "schemaOrg", "openGraph", "socialMedia"]
    };

    const stage2Model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 65536, // Maximum limit to prevent truncation of metadata and social media content
        temperature: 0.5, // Slightly higher for creative social media content
        topP: 0.95,
        responseSchema: metadataSchema,
        responseMimeType: "application/json",
      },
    });

    // Stage 2 prompt includes the article text from Stage 1
    const stage2PromptWithArticle = `${METADATA_GENERATION_PROMPT}\n\n**ARTIKEL ZUM ANALYSIEREN:**\n\n${audioAnalysis.markdown}`;

    const stage2Request = {
      contents: [{
        role: "user",
        parts: [{
          text: stage2PromptWithArticle,
        }],
      }],
    };

    logger.info("[Stage 2] Sending article to Gemini Flash for metadata generation...");
    logger.info(`[Stage 2] Input article length: ${audioAnalysis.markdown.length} chars`);
    const stage2StartTime = Date.now();

    const stage2Result = await retryWithExponentialBackoff(async () => {
      return await stage2Model.generateContent(stage2Request);
    });

    const stage2Duration = ((Date.now() - stage2StartTime) / 1000).toFixed(2);
    logger.info(`[Stage 2] ⏱️ Completed in ${stage2Duration}s`);

    // Extract and parse Stage 2 response
    const stage2Response = stage2Result.response;
    const stage2Candidates = stage2Response.candidates;

    if (!stage2Candidates || stage2Candidates.length === 0) {
      throw new Error("[Stage 2] No candidates in response");
    }

    let stage2Text = "";
    for (const candidate of stage2Candidates) {
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            stage2Text += part.text;
          }
        }
      }
    }

    if (!stage2Text) {
      throw new Error("[Stage 2] No text content in response");
    }

    logger.info(`[Stage 2] Response length: ${stage2Text.length} characters`);

    // Parse Stage 2 JSON
    let metadata: MetadataResult;
    try {
      metadata = JSON.parse(stage2Text.trim());
      logger.info("[Stage 2] ✅ Successfully parsed metadata");
      logger.info(`[Stage 2] Title: ${metadata.title}`);
      logger.info(`[Stage 2] Meta description length: ${metadata.metaDescription?.length || 0} chars`);
      logger.info(`[Stage 2] Keywords: ${metadata.keywords?.length || 0}`);
      logger.info(`[Stage 2] Social platforms: ${Object.keys(metadata.socialMedia || {}).length}`);
    } catch (error: any) {
      logger.error("[Stage 2] ❌ Failed to parse JSON:", error.message);
      logger.error(`[Stage 2] First 500 chars: ${stage2Text.substring(0, 500)}`);
      logger.error(`[Stage 2] Last 500 chars: ${stage2Text.substring(Math.max(0, stage2Text.length - 500))}`);
      throw new Error(`Stage 2 JSON parsing failed: ${error.message}`);
    }

    // Auto-fix metaDescription if needed
    const fixedMetaDescription = fixMetaDescription(metadata.metaDescription);
    if (fixedMetaDescription !== metadata.metaDescription) {
      logger.info(`[Stage 2] 🔧 Auto-fixed metaDescription: ${metadata.metaDescription.length} → ${fixedMetaDescription.length} chars`);
      metadata.metaDescription = fixedMetaDescription;
    }

    // ========================================
    // APP GENERATION: HTML + Slug
    // ========================================
    logger.info("\n" + "=".repeat(80));
    logger.info("[App Generation] Converting markdown → HTML and generating slug");
    logger.info("=".repeat(80));

    const html = markdownToHtml(audioAnalysis.markdown);
    const slug = generateSlug(metadata.title);

    logger.info(`[App Generation] ✅ HTML generated: ${html.length} chars`);
    logger.info(`[App Generation] ✅ Slug generated: ${slug}`);

    // ========================================
    // COMBINE RESULTS
    // ========================================
    const totalDuration = ((Date.now() - stage1StartTime) / 1000).toFixed(2);
    logger.info("\n" + "=".repeat(80));
    logger.info(`[Two-Stage Pipeline] ✅ COMPLETE | Total time: ${totalDuration}s`);
    logger.info("=".repeat(80));

    const blogArticle: BlogArticle = {
      title: metadata.title,
      slug: slug,
      metaDescription: metadata.metaDescription,
      keywords: metadata.keywords,
      markdown: audioAnalysis.markdown,
      html: html,
      schemaOrg: metadata.schemaOrg,
      openGraph: metadata.openGraph,
      socialMedia: metadata.socialMedia,
      showNotes: undefined, // Show notes removed for simplified generation
    };

    logger.info("[Two-Stage Pipeline] Final article structure:");
    logger.info(`  - Title: ${blogArticle.title}`);
    logger.info(`  - Slug: ${blogArticle.slug}`);
    logger.info(`  - Markdown: ${blogArticle.markdown.length} chars`);
    logger.info(`  - HTML: ${blogArticle.html.length} chars`);
    logger.info(`  - Keywords: ${blogArticle.keywords.length}`);
    logger.info(`  - Social platforms: ${Object.keys(blogArticle.socialMedia || {}).length}`);

    return blogArticle;

  } catch (error: any) {
    logger.error("=".repeat(80));
    logger.error("[Two-Stage Pipeline] ❌ FAILED");
    logger.error("=".repeat(80));
    logger.error(`Error message: ${error.message}`);
    logger.error(`Error type: ${error?.constructor?.name || 'Unknown'}`);
    logger.error(`Error code: ${error?.code || '(no code)'}`);
    logger.error(`Stack: ${error?.stack || '(no stack)'}`);
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
