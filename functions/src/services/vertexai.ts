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
 * Validate that a generated article is complete and properly structured
 * @param markdown The markdown content to validate
 * @param stage Stage identifier for error messages (e.g., "Stage 1")
 * @param targetMinWords The minimum word count based on podcast duration
 * @throws Error if article is incomplete or improperly structured
 */
function validateArticleCompleteness(markdown: string, stage: string, targetMinWords: number = 500): void {
  if (!markdown || markdown.trim().length === 0) {
    throw new Error(`[${stage}] Article is empty`);
  }

  // Word count validation
  const words = markdown.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  if (wordCount < targetMinWords) {
    throw new Error(`[${stage}] Article too short: ${wordCount} words (minimum: ${targetMinWords} for SEO quality based on ${Math.floor(targetMinWords / 15)}-${Math.floor(targetMinWords / 10)} minute podcast)`);
  }

  // Structure validation - must have H1 heading
  if (!markdown.includes('# ')) {
    throw new Error(`[${stage}] Missing H1 heading - article structure incomplete`);
  }

  // Structure validation - must have H2 sections
  if (!markdown.includes('## ')) {
    throw new Error(`[${stage}] Missing H2 sections - article structure incomplete`);
  }

  // Conclusion section check (common German conclusion headers)
  const hasFazit = /##\s*(Fazit|Zusammenfassung|Schluss|Abschluss)/i.test(markdown);
  if (!hasFazit) {
    logger.warn(`[${stage}] ⚠️ No conclusion section found - article may be incomplete`);
  }

  // Sentence completeness - verify article doesn't end abruptly
  const lastChar = markdown.trim().slice(-1);
  if (!['.', '!', '?', ')'].includes(lastChar)) {
    throw new Error(`[${stage}] Article ends abruptly without proper punctuation (last char: '${lastChar}')`);
  }

  logger.info(`[${stage}] ✅ Article validation passed: ${wordCount} words, proper structure, complete sentences`);
}

/**
 * Two-Stage Audio Processing Pipeline
 *
 * Processes podcast audio in two optimized stages to prevent truncation:
 * - Stage 1: Audio Analysis → markdown article (requires audio access)
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
 * @param durationMinutes - Duration of the podcast in minutes
 * @returns Complete BlogArticle with all metadata
 */
export async function processAudioTwoStage(
  storagePath: string,
  mimeType: string = "audio/mpeg",
  durationMinutes?: number
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

    // Calculate target word count based on duration
    let targetMinWords = 600;
    let targetMaxWords = 800;

    if (durationMinutes) {
      if (durationMinutes > 90) {
        targetMinWords = 1500;
        targetMaxWords = 2000;
      } else if (durationMinutes > 30) {
        targetMinWords = 1000;
        targetMaxWords = 1500;
      } else if (durationMinutes > 15) {
        targetMinWords = 800;
        targetMaxWords = 1000;
      }
      logger.info(`[Two-Stage Pipeline] Podcast duration: ${durationMinutes} minutes`);
      logger.info(`[Two-Stage Pipeline] Target word count: ${targetMinWords}-${targetMaxWords} words`);
    } else {
      logger.warn("[Two-Stage Pipeline] No duration provided, using default word count targets");
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

    // Build context-aware prompt with duration and word count targets
    let contextualPrompt = AUDIO_ANALYSIS_PROMPT;
    if (durationMinutes) {
      // Add explicit duration and word count requirement at the beginning and end
      const durationContext = `
**KRITISCHE ANWEISUNG - PODCAST-KONTEXT:**
- Dieser Podcast ist ${durationMinutes} Minuten lang
- Du MUSST ${targetMinWords}-${targetMaxWords} Wörter schreiben
- NIEMALS weniger als ${targetMinWords} Wörter schreiben
- Zähle während des Schreibens mit und überprüfe die Wortanzahl

`;

      const enforcementReminder = `

**FINALE ÜBERPRÜFUNG (KRITISCH):**
1. Dieser Podcast ist ${durationMinutes} Minuten lang
2. Du MUSST ${targetMinWords}-${targetMaxWords} Wörter geschrieben haben
3. Wenn du weniger als ${targetMinWords} Wörter hast, füge weitere Details hinzu
4. Beende NUR wenn du mindestens ${targetMinWords} Wörter erreicht hast
5. Schreibe einen vollständigen Artikel mit natürlichem Abschluss`;

      contextualPrompt = durationContext + AUDIO_ANALYSIS_PROMPT + enforcementReminder;
    }

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
            text: contextualPrompt,
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

    // CRITICAL: Check finishReason to detect truncation
    const stage1FinishReason = stage1Candidates[0]?.finishReason;
    const stage1UsageMetadata = (stage1Response as any).usageMetadata;

    logger.info(`[Stage 1] finishReason: ${stage1FinishReason}`);
    if (stage1UsageMetadata) {
      logger.info(`[Stage 1] Token usage: ${stage1UsageMetadata.candidatesTokenCount || 'unknown'}/${65536}`);
    }

    if (stage1FinishReason !== "STOP") {
      const tokenInfo = stage1UsageMetadata?.candidatesTokenCount
        ? `Tokens used: ${stage1UsageMetadata.candidatesTokenCount}/65536`
        : "Token count unavailable";

      throw new Error(
        `[Stage 1] Generation incomplete! finishReason=${stage1FinishReason}. ${tokenInfo}. ` +
        `This indicates the article was truncated. Possible causes: ` +
        `MAX_TOKENS (hit limit), SAFETY (content filtered), RECITATION (copyright), OTHER (model error).`
      );
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

    // CRITICAL: Validate JSON completeness before parsing
    const stage1Trimmed = stage1Text.trim();
    if (!stage1Trimmed.startsWith('{')) {
      throw new Error(
        `[Stage 1] Incomplete JSON - doesn't start with '{'. ` +
        `First char: '${stage1Trimmed[0]}'. Response likely truncated at the beginning.`
      );
    }
    if (!stage1Trimmed.endsWith('}')) {
      throw new Error(
        `[Stage 1] Incomplete JSON - doesn't end with '}'. ` +
        `Last char: '${stage1Trimmed[stage1Trimmed.length - 1]}'. Response likely truncated at the end.`
      );
    }
    logger.info(`[Stage 1] ✅ JSON structure validation passed`);

    // Parse Stage 1 JSON
    let audioAnalysis: AudioAnalysisResult;
    try {
      audioAnalysis = JSON.parse(stage1Trimmed);
      logger.info("[Stage 1] ✅ Successfully parsed audio analysis");
      logger.info(`[Stage 1] Markdown length: ${audioAnalysis.markdown?.length || 0} chars`);
    } catch (error: any) {
      logger.error("[Stage 1] ❌ Failed to parse JSON:", error.message);
      logger.error(`[Stage 1] First 500 chars: ${stage1Text.substring(0, 500)}`);
      logger.error(`[Stage 1] Last 500 chars: ${stage1Text.substring(Math.max(0, stage1Text.length - 500))}`);
      throw new Error(`Stage 1 JSON parsing failed: ${error.message}`);
    }

    // CRITICAL: Validate article completeness and quality
    validateArticleCompleteness(audioAnalysis.markdown, "Stage 1", targetMinWords);

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

    // CRITICAL: Check finishReason to detect truncation
    const stage2FinishReason = stage2Candidates[0]?.finishReason;
    const stage2UsageMetadata = (stage2Response as any).usageMetadata;

    logger.info(`[Stage 2] finishReason: ${stage2FinishReason}`);
    if (stage2UsageMetadata) {
      logger.info(`[Stage 2] Token usage: ${stage2UsageMetadata.candidatesTokenCount || 'unknown'}/${65536}`);
    }

    if (stage2FinishReason !== "STOP") {
      const tokenInfo = stage2UsageMetadata?.candidatesTokenCount
        ? `Tokens used: ${stage2UsageMetadata.candidatesTokenCount}/65536`
        : "Token count unavailable";

      throw new Error(
        `[Stage 2] Generation incomplete! finishReason=${stage2FinishReason}. ${tokenInfo}. ` +
        `This indicates the metadata was truncated. Possible causes: ` +
        `MAX_TOKENS (hit limit), SAFETY (content filtered), RECITATION (copyright), OTHER (model error).`
      );
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

    // CRITICAL: Validate JSON completeness before parsing
    const stage2Trimmed = stage2Text.trim();
    if (!stage2Trimmed.startsWith('{')) {
      throw new Error(
        `[Stage 2] Incomplete JSON - doesn't start with '{'. ` +
        `First char: '${stage2Trimmed[0]}'. Response likely truncated at the beginning.`
      );
    }
    if (!stage2Trimmed.endsWith('}')) {
      throw new Error(
        `[Stage 2] Incomplete JSON - doesn't end with '}'. ` +
        `Last char: '${stage2Trimmed[stage2Trimmed.length - 1]}'. Response likely truncated at the end.`
      );
    }
    logger.info(`[Stage 2] ✅ JSON structure validation passed`);

    // Parse Stage 2 JSON
    let metadata: MetadataResult;
    try {
      metadata = JSON.parse(stage2Trimmed);
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

    // CRITICAL: Validate metadata completeness
    const missingFields: string[] = [];
    if (!metadata.title) missingFields.push("title");
    if (!metadata.metaDescription) missingFields.push("metaDescription");
    if (!metadata.keywords || metadata.keywords.length === 0) missingFields.push("keywords");
    if (!metadata.schemaOrg) missingFields.push("schemaOrg");
    if (!metadata.openGraph) missingFields.push("openGraph");
    if (!metadata.socialMedia) {
      missingFields.push("socialMedia");
    } else {
      // Check required social media platforms
      const requiredPlatforms = ["linkedin", "twitter", "instagram", "facebook", "tiktok", "newsletter"];
      for (const platform of requiredPlatforms) {
        if (!metadata.socialMedia[platform as keyof typeof metadata.socialMedia]) {
          missingFields.push(`socialMedia.${platform}`);
        }
      }
      // Validate Twitter has exactly 4 tweets
      if (metadata.socialMedia.twitter && (!Array.isArray(metadata.socialMedia.twitter) || metadata.socialMedia.twitter.length !== 4)) {
        logger.warn(`[Stage 2] ⚠️ Twitter should have exactly 4 tweets, got ${metadata.socialMedia.twitter.length}`);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(`[Stage 2] Incomplete metadata - missing fields: ${missingFields.join(", ")}`);
    }

    logger.info(`[Stage 2] ✅ Metadata validation passed - all required fields present`);

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
