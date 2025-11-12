import { SchemaType } from "@google-cloud/vertexai";
import * as logger from "firebase-functions/logger";
import { METADATA_GENERATION_PROMPT } from "../../utils/prompts";
import { getVertexAIClient } from "./client";
import { retryWithExponentialBackoff, withTimeout } from "./utils";
import { TokenUsageInfo, SocialMediaContent } from "../../types/podcast";
import { calculateTextTokenCost } from "./cost-calculator";
import { getVertexAICircuitBreaker } from "./circuit-breaker";

/**
 * STAGE 2: Generate Metadata from Article
 *
 * Uses Gemini 2.5 Flash to generate comprehensive SEO and social media metadata
 * based on the article text (not the audio).
 *
 * Benefits:
 * - No audio processing needed (faster)
 * - Dedicated token budget for metadata quality
 * - Can be regenerated without re-processing audio
 *
 * @param articleText - The article markdown + title + description
 * @returns Complete metadata package
 */
export async function generateMetadataFromArticle(
  articleText: string,
  title: string,
  metaDescription: string
): Promise<{
  schemaOrg: Record<string, any>;
  openGraph: Record<string, string>;
  socialMedia: SocialMediaContent;
  tokenUsage: TokenUsageInfo;
}> {
  try {
    logger.info("=".repeat(80));
    logger.info("[Stage 2: Metadata Generation] Starting metadata generation from article");
    logger.info("=".repeat(80));

    // Get Vertex AI client
    const vertexAI = getVertexAIClient();

    // Define metadata schema with nested structure
    const metadataSchema = {
      type: SchemaType.OBJECT,
      properties: {
        schemaOrg: {
          type: SchemaType.OBJECT,
          description: "Complete Schema.org BlogPosting JSON-LD markup",
          properties: {
            "@context": { type: SchemaType.STRING, description: "Must be 'https://schema.org'" },
            "@type": { type: SchemaType.STRING, description: "Must be 'BlogPosting'" },
            headline: { type: SchemaType.STRING, description: "Article title (max 110 chars)" },
            description: { type: SchemaType.STRING, description: "Article description (150-200 chars)" },
            author: {
              type: SchemaType.OBJECT,
              properties: {
                "@type": { type: SchemaType.STRING },
                name: { type: SchemaType.STRING }
              }
            },
            publisher: {
              type: SchemaType.OBJECT,
              properties: {
                "@type": { type: SchemaType.STRING },
                name: { type: SchemaType.STRING }
              }
            },
            datePublished: { type: SchemaType.STRING, description: "ISO 8601 date" },
            dateModified: { type: SchemaType.STRING, description: "ISO 8601 date" },
            image: { type: SchemaType.STRING, description: "Image URL" },
            articleBody: { type: SchemaType.STRING, description: "First paragraph or summary" }
          },
          required: ["@context", "@type", "headline", "description", "author", "publisher", "datePublished"]
        },
        openGraph: {
          type: SchemaType.OBJECT,
          description: "Complete Open Graph metadata for social sharing",
          properties: {
            "og:title": { type: SchemaType.STRING, description: "Title (max 60 chars)" },
            "og:description": { type: SchemaType.STRING, description: "Description (120-155 chars)" },
            "og:type": { type: SchemaType.STRING, description: "Must be 'article'" },
            "og:url": { type: SchemaType.STRING, description: "Article URL" },
            "og:image": { type: SchemaType.STRING, description: "Image URL (1200x630px recommended)" },
            "og:image:width": { type: SchemaType.STRING, description: "Image width (e.g., '1200')" },
            "og:image:height": { type: SchemaType.STRING, description: "Image height (e.g., '630')" },
            "og:site_name": { type: SchemaType.STRING, description: "Site name" },
            "article:published_time": { type: SchemaType.STRING, description: "ISO 8601 date" },
            "article:author": { type: SchemaType.STRING, description: "Author name" },
            "article:tag": { type: SchemaType.STRING, description: "Comma-separated keywords" }
          },
          required: ["og:title", "og:description", "og:type", "og:url", "og:image"]
        },
        socialMedia: {
          type: SchemaType.OBJECT,
          description: "Social media posts for 6 platforms",
          properties: {
            linkedin: {
              type: SchemaType.STRING,
              description: "LinkedIn post (250-300 chars, professional, 3-5 hashtags)"
            },
            twitter: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Twitter thread (4 tweets, max 280 chars each)",
              minItems: 4,
              maxItems: 4
            },
            instagram: {
              type: SchemaType.STRING,
              description: "Instagram caption (120-150 words, emotional, 10-15 hashtags)"
            },
            facebook: {
              type: SchemaType.STRING,
              description: "Facebook post (200-250 words, storytelling)"
            },
            tiktok: {
              type: SchemaType.STRING,
              description: "TikTok video script (30 seconds, dynamic)"
            },
            newsletter: {
              type: SchemaType.STRING,
              description: "Newsletter teaser (3-4 sentences, max 100 words)"
            }
          },
          required: ["linkedin", "twitter", "instagram", "facebook", "tiktok", "newsletter"]
        }
      },
      required: ["schemaOrg", "openGraph", "socialMedia"]
    };

    // Create model for metadata generation
    const metadataModel = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: {
        role: "system",
        parts: [{
          text: `Du bist ein SEO- und Social-Media-Experte. Deine Aufgabe ist es, umfassende Metadaten basierend auf Artikeln zu erstellen.`
        }]
      },
      generationConfig: {
        maxOutputTokens: 65536, // Full token budget for comprehensive metadata
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        responseSchema: metadataSchema,
        responseMimeType: "application/json",
      },
    });

    // Build request with article text
    const metadataRequest = {
      contents: [{
        role: "user",
        parts: [
          {
            text: `${METADATA_GENERATION_PROMPT}\n\n# ARTIKEL-TITEL:\n${title}\n\n# META-DESCRIPTION:\n${metaDescription}\n\n# ARTIKEL-INHALT:\n${articleText}`,
          },
        ],
      }],
    };

    logger.info("[Stage 2] Sending article to Gemini Flash for metadata generation...");
    const startTime = Date.now();

    // Get circuit breaker instance
    const circuitBreaker = getVertexAICircuitBreaker();

    // Execute with timeout + circuit breaker for complete protection
    const result = await withTimeout(
      async () => {
        return await circuitBreaker.execute(async () => {
          return await retryWithExponentialBackoff(async () => {
            return await metadataModel.generateContent(metadataRequest);
          });
        });
      },
      undefined, // Use default timeout from constants (45 min)
      "Stage 2: Metadata Generation"
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`[Stage 2] ⏱️ Metadata generation completed in ${duration}s`);

    // Extract and parse response
    const response = result.response;
    const candidates = response.candidates;

    // Calculate and log token usage with costs
    let tokenUsage: TokenUsageInfo;

    if (response.usageMetadata) {
      const usage = response.usageMetadata;
      const promptTokens = usage.promptTokenCount || 0;
      const candidatesTokens = usage.candidatesTokenCount || 0;
      const totalTokens = usage.totalTokenCount || 0;

      logger.info(`[Stage 2] 📊 Token Usage:`);
      logger.info(`[Stage 2]    - Prompt tokens: ${promptTokens}`);
      logger.info(`[Stage 2]    - Candidates tokens: ${candidatesTokens}`);
      logger.info(`[Stage 2]    - Total tokens: ${totalTokens}`);

      // Calculate costs
      const cost = calculateTextTokenCost({
        promptTokens,
        candidatesTokens,
        totalTokens,
      });

      logger.info(`[Stage 2] 💰 Cost Estimate:`);
      logger.info(`[Stage 2]    - Total: $${cost.totalCostUSD.toFixed(6)} / €${cost.totalCostEUR.toFixed(6)}`);

      tokenUsage = {
        inputTokens: promptTokens,
        outputTokens: candidatesTokens,
        totalTokens,
        costUSD: cost.totalCostUSD,
        costEUR: cost.totalCostEUR,
      };
    } else {
      logger.warn(`[Stage 2] ⚠️ No usage metadata available - cannot calculate costs`);
      // Fallback with zero values
      tokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUSD: 0,
        costEUR: 0,
      };
    }

    if (!candidates || candidates.length === 0) {
      throw new Error("[Stage 2] No candidates in response");
    }

    // Extract response text
    let responseText = "";
    for (const candidate of candidates) {
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            responseText += part.text;
          }
        }
      }
    }

    // Check finishReason - MUST be STOP for complete generation
    const finishReason = candidates[0]?.finishReason;

    if (finishReason !== "STOP") {
      logger.error(`[Stage 2] ❌ Non-STOP finishReason: ${finishReason}`);
      logger.error(`[Stage 2] Metadata generation incomplete - rejecting response`);

      // Log detailed reason and throw error
      if (finishReason === "MAX_TOKENS") {
        logger.error(`[Stage 2] Hit token limit - metadata was truncated`);
        throw new Error("[Stage 2] Metadata generation incomplete: MAX_TOKENS exceeded.");
      } else if (finishReason === "SAFETY") {
        logger.error(`[Stage 2] Safety filters triggered`);
        throw new Error("[Stage 2] Metadata generation incomplete: SAFETY filters triggered.");
      } else if (finishReason === "RECITATION") {
        logger.error(`[Stage 2] Recitation detected`);
        throw new Error("[Stage 2] Metadata generation incomplete: RECITATION detected.");
      } else {
        logger.error(`[Stage 2] Unknown finishReason: ${finishReason}`);
        throw new Error(`[Stage 2] Metadata generation incomplete: Unknown finishReason '${finishReason}'.`);
      }
    }

    // Response text already extracted above for diagnostics
    if (!responseText) {
      throw new Error("[Stage 2] No text content in response");
    }

    // Validate JSON structure
    const trimmed = responseText.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      logger.error(`[Stage 2] ❌ Incomplete JSON response`);
      logger.error(`[Stage 2] Response starts with: ${trimmed.slice(0, 100)}`);
      logger.error(`[Stage 2] Response ends with: ${trimmed.slice(-100)}`);
      throw new Error("[Stage 2] Incomplete JSON response");
    }

    // Parse JSON with error handling
    let metadataData;
    try {
      metadataData = JSON.parse(trimmed);
    } catch (parseError: unknown) {
      const typedError = parseError instanceof Error ? parseError : new Error(String(parseError));
      logger.error(`[Stage 2] ❌ JSON parsing failed`);
      logger.error(`[Stage 2] Parse error: ${typedError.message}`);
      logger.error(`[Stage 2] Response preview (first 500 chars): ${trimmed.slice(0, 500)}`);
      logger.error(`[Stage 2] Response preview (last 500 chars): ${trimmed.slice(-500)}`);
      throw new Error(`[Stage 2] JSON parsing failed: ${typedError.message}`);
    }

    // Basic metadata validation logging
    const schemaOrgKeys = Object.keys(metadataData.schemaOrg || {});
    const openGraphKeys = Object.keys(metadataData.openGraph || {});
    const socialMediaKeys = Object.keys(metadataData.socialMedia || {});

    // Validate required fields exist
    const requiredFields = ["schemaOrg", "openGraph", "socialMedia"];
    const missingFields = requiredFields.filter(field => !metadataData[field]);

    if (missingFields.length > 0) {
      logger.error(`[Stage 2] ❌ Missing required fields: ${missingFields.join(', ')}`);
      throw new Error(`[Stage 2] Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate metadata objects are not empty
    if (schemaOrgKeys.length === 0) {
      logger.error(`[Stage 2] ❌ schemaOrg object is empty`);
      throw new Error("[Stage 2] schemaOrg object is empty - metadata generation failed");
    }

    if (openGraphKeys.length === 0) {
      logger.error(`[Stage 2] ❌ openGraph object is empty`);
      throw new Error("[Stage 2] openGraph object is empty - metadata generation failed");
    }

    if (socialMediaKeys.length === 0) {
      logger.error(`[Stage 2] ❌ socialMedia object is empty`);
      throw new Error("[Stage 2] socialMedia object is empty - metadata generation failed");
    }

    // Validate critical schemaOrg fields
    const requiredSchemaOrgFields = ["@type", "headline"];
    const missingSchemaOrgFields = requiredSchemaOrgFields.filter(field => !metadataData.schemaOrg[field]);

    if (missingSchemaOrgFields.length > 0) {
      logger.error(`[Stage 2] ❌ Missing critical schemaOrg fields: ${missingSchemaOrgFields.join(', ')}`);
      throw new Error(`[Stage 2] Missing critical schemaOrg fields: ${missingSchemaOrgFields.join(', ')}`);
    }

    // Validate critical openGraph fields (use correct og: prefix)
    const requiredOpenGraphFields = ["og:title", "og:description"];
    const missingOpenGraphFields = requiredOpenGraphFields.filter(field => !metadataData.openGraph[field]);

    if (missingOpenGraphFields.length > 0) {
      logger.error(`[Stage 2] ❌ Missing critical openGraph fields: ${missingOpenGraphFields.join(', ')}`);
      throw new Error(`[Stage 2] Missing critical openGraph fields: ${missingOpenGraphFields.join(', ')}`);
    }

    logger.info(`[Stage 2] ✅ Metadata generation successful`);
    logger.info(`[Stage 2] All validation checks passed`);

    return {
      schemaOrg: metadataData.schemaOrg,
      openGraph: metadataData.openGraph,
      socialMedia: metadataData.socialMedia,
      tokenUsage,
    };

  } catch (error: unknown) {
    const typedError = error instanceof Error ? error : new Error(String(error));
    logger.error("=".repeat(80));
    logger.error("[Stage 2: Metadata Generation] ❌ FAILED");
    logger.error("=".repeat(80));
    logger.error(`Error message: ${typedError.message}`);
    logger.error(`Error type: ${typedError.constructor.name || 'Unknown'}`);
    logger.error(`Error code: ${(typedError as any).code || '(no code)'}`);
    throw typedError;
  }
}
