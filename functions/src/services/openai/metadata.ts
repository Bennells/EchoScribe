import * as logger from "firebase-functions/logger";
import { getOpenAIClient } from "./client";
import { calculateOpenAICost } from "./cost-calculator";
import { retryWithExponentialBackoff, withTimeout } from "./utils";
import { getOpenAICircuitBreaker } from "./circuit-breaker";
import { METADATA_GENERATION_PROMPT } from "../../utils/prompts";
import { TokenUsageInfo, PodcastMetadata } from "../../types/podcast";

/**
 * Generate SEO and social media metadata from article using GPT-4o-mini
 *
 * This implements Stage 2 of the two-stage pipeline:
 * - Takes article markdown and title as input
 * - Generates Schema.org JSON-LD
 * - Generates Open Graph tags
 * - Generates social media posts for 6 platforms
 * - Uses structured output with STRICT token limits (2500 max)
 * - Prevents over-generation that occurred with Gemini (63k tokens!)
 *
 * @param articleMarkdown - The generated article in Markdown
 * @param articleTitle - The article title
 * @returns Metadata with token usage
 */
export async function generateMetadataFromArticle(
  articleMarkdown: string,
  articleTitle: string
): Promise<{
  metadata: PodcastMetadata;
  tokenUsage: TokenUsageInfo;
}> {

  logger.info("=".repeat(80));
  logger.info("[OpenAI Metadata] Starting metadata generation (Stage 2)");
  logger.info("=".repeat(80));

  const startTime = Date.now();

  try {
    const openai = getOpenAIClient();
    const circuitBreaker = getOpenAICircuitBreaker();

    logger.info(`[OpenAI Metadata] Article length: ${articleMarkdown.length} characters`);
    logger.info(`[OpenAI Metadata] Title: ${articleTitle}`);

    // Define metadata schema (OpenAI format with STRICT limits)
    const metadataSchema = {
      type: "object" as const,
      properties: {
        schemaOrg: {
          type: "object" as const,
          properties: {
            "@context": { type: "string" as const },
            "@type": { type: "string" as const },
            headline: {
              type: "string" as const,
              description: "Article headline (max 110 characters)",
              maxLength: 110
            },
            description: {
              type: "string" as const,
              description: "Short description (max 200 characters)",
              maxLength: 200
            },
            author: {
              type: "object" as const,
              properties: {
                "@type": { type: "string" as const },
                name: { type: "string" as const }
              },
              required: ["@type", "name"],
              additionalProperties: false
            },
            publisher: {
              type: "object" as const,
              properties: {
                "@type": { type: "string" as const },
                name: { type: "string" as const }
              },
              required: ["@type", "name"],
              additionalProperties: false
            },
            datePublished: { type: "string" as const },
            dateModified: { type: "string" as const },
            image: { type: "string" as const },
            articleBody: {
              type: "string" as const,
              description: "ONLY first 150 characters of article - NOT THE FULL ARTICLE!",
              maxLength: 150
            }
          },
          required: ["@context", "@type", "headline", "description", "author", "publisher", "datePublished", "dateModified", "image", "articleBody"],
          additionalProperties: false
        },
        openGraph: {
          type: "object" as const,
          properties: {
            "og:title": {
              type: "string" as const,
              maxLength: 60
            },
            "og:description": {
              type: "string" as const,
              maxLength: 155
            },
            "og:type": { type: "string" as const },
            "og:url": { type: "string" as const },
            "og:image": { type: "string" as const },
            "og:image:width": { type: "string" as const },
            "og:image:height": { type: "string" as const },
            "og:site_name": { type: "string" as const },
            "article:published_time": { type: "string" as const },
            "article:author": { type: "string" as const },
            "article:tag": { type: "string" as const }
          },
          required: [
            "og:title",
            "og:description",
            "og:type",
            "og:url",
            "og:image",
            "og:image:width",
            "og:image:height",
            "og:site_name",
            "article:published_time",
            "article:author",
            "article:tag"
          ],
          additionalProperties: false
        },
        socialMedia: {
          type: "object" as const,
          properties: {
            linkedin: {
              type: "string" as const,
              description: "LinkedIn post (max 300 characters)",
              maxLength: 300
            },
            twitter: {
              type: "array" as const,
              items: {
                type: "string" as const,
                maxLength: 280
              },
              description: "Exactly 4 tweets, each max 280 characters",
              minItems: 4,
              maxItems: 4
            },
            instagram: {
              type: "string" as const,
              description: "Instagram caption (max 500 characters)",
              maxLength: 500
            },
            facebook: {
              type: "string" as const,
              description: "Facebook post (max 500 characters)",
              maxLength: 500
            },
            tiktok: {
              type: "string" as const,
              description: "TikTok script (max 300 characters)",
              maxLength: 300
            },
            newsletter: {
              type: "string" as const,
              description: "Newsletter teaser (max 300 characters)",
              maxLength: 300
            }
          },
          required: ["linkedin", "twitter", "instagram", "facebook", "tiktok", "newsletter"],
          additionalProperties: false
        }
      },
      required: ["schemaOrg", "openGraph", "socialMedia"],
      additionalProperties: false
    };

    // Build system instruction
    const systemInstruction = `Du bist ein SEO- und Social-Media-Experte. Erstelle präzise, kompakte Metadaten basierend auf dem Artikel. Sei KNAPP und PRÄZISE - keine ausschweifenden Texte!`;

    // Build user prompt
    const userPrompt = `${METADATA_GENERATION_PROMPT}

**ARTIKEL-TITEL:**
${articleTitle}

**ARTIKEL-INHALT:**
${articleMarkdown}`;

    // Build messages array
    const messages: Array<{role: "system" | "user"; content: string}> = [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ];

    logger.info("[OpenAI Metadata] Sending request to OpenAI...");

    // Generate with protection layers (timeout + circuit breaker + retry)
    const completion = await withTimeout(
      async () => {
        return await circuitBreaker.execute(async () => {
          return await retryWithExponentialBackoff(async () => {
            return await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: messages,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "metadata_response",
                  strict: true,
                  schema: metadataSchema
                }
              },
              max_tokens: 2500, // STRICT LIMIT to prevent 63k token over-generation
              temperature: 0.7,
            });
          });
        });
      },
      undefined, // Use default timeout from utils (2 minutes)
      "Stage 2: Metadata Generation"
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`[OpenAI Metadata] ✅ Generation completed in ${duration}s`);

    // Check finish reason
    const finishReason = completion.choices[0]?.finish_reason;
    logger.info(`[OpenAI Metadata] finish_reason: ${finishReason}`);

    if (finishReason !== "stop") {
      logger.error(`[OpenAI Metadata] ❌ Non-stop finish_reason: ${finishReason}`);

      if (finishReason === "length") {
        logger.error(`[OpenAI Metadata] Hit max_tokens limit (2500) - metadata was truncated`);
        throw new Error(`[OpenAI Metadata] Metadata generation incomplete: MAX_TOKENS exceeded. Consider simplifying the article.`);
      } else {
        throw new Error(`[OpenAI Metadata] Metadata generation incomplete: finish_reason '${finishReason}'`);
      }
    }

    // Parse response
    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("[OpenAI Metadata] No content in response");
    }

    logger.info(`[OpenAI Metadata] Response length: ${responseText.length} characters`);

    // Parse JSON
    let metadataData: {
      schemaOrg: any;
      openGraph: any;
      socialMedia: any;
    };

    try {
      metadataData = JSON.parse(responseText);
    } catch (parseError: unknown) {
      const typedError = parseError instanceof Error ? parseError : new Error(String(parseError));
      logger.error(`[OpenAI Metadata] ❌ JSON parsing failed`);
      logger.error(`[OpenAI Metadata] Parse error: ${typedError.message}`);
      throw new Error(`[OpenAI Metadata] JSON parsing failed: ${typedError.message}`);
    }

    // Validate required top-level fields
    const requiredFields: Array<keyof typeof metadataData> = ["schemaOrg", "openGraph", "socialMedia"];
    const missingFields = requiredFields.filter(field => !metadataData[field]);

    if (missingFields.length > 0) {
      logger.error(`[OpenAI Metadata] ❌ Missing required fields: ${missingFields.join(', ')}`);
      throw new Error(`[OpenAI Metadata] Missing required fields: ${missingFields.join(', ')}`);
    }

    // Calculate token usage and costs
    const usage = completion.usage!;
    const { costUSD, costEUR } = calculateOpenAICost(
      "gpt-4o-mini",
      usage.prompt_tokens,
      usage.completion_tokens
    );

    const tokenUsage: TokenUsageInfo = {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUSD,
      costEUR,
    };

    logger.info(`[OpenAI Metadata] 📊 Token Usage:`);
    logger.info(`[OpenAI Metadata]    - Input tokens: ${usage.prompt_tokens}`);
    logger.info(`[OpenAI Metadata]    - Output tokens: ${usage.completion_tokens}`);
    logger.info(`[OpenAI Metadata]    - Total tokens: ${usage.total_tokens}`);
    logger.info(`[OpenAI Metadata] 💰 Cost: $${costUSD.toFixed(6)} / €${costEUR.toFixed(6)}`);

    // Verify token count is reasonable (should be ~1500-2000, NOT 63k!)
    if (usage.completion_tokens > 3000) {
      logger.warn(`[OpenAI Metadata] ⚠️ Unusually high token count: ${usage.completion_tokens} tokens`);
      logger.warn(`[OpenAI Metadata] Expected: 1500-2000 tokens. This may indicate over-generation.`);
    }

    logger.info(`[OpenAI Metadata] ✅ Metadata generation successful`);

    logger.info("=".repeat(80));
    logger.info("[OpenAI Metadata] ✅ Stage 2 Complete");
    logger.info("=".repeat(80));

    // Map to PodcastMetadata type
    const metadata: PodcastMetadata = {
      schemaOrg: metadataData.schemaOrg,
      openGraph: metadataData.openGraph,
      socialMedia: metadataData.socialMedia,
    };

    return {
      metadata,
      tokenUsage,
    };

  } catch (error: unknown) {
    const typedError = error instanceof Error ? error : new Error(String(error));
    logger.error("=".repeat(80));
    logger.error("[OpenAI Metadata] ❌ FAILED");
    logger.error("=".repeat(80));
    logger.error(`Error message: ${typedError.message}`);
    logger.error(`Error type: ${typedError.constructor.name || 'Unknown'}`);
    throw typedError;
  }
}
