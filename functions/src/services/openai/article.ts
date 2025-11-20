import * as logger from "firebase-functions/logger";
import { getOpenAIClient } from "./client";
import { calculateOpenAICost } from "./cost-calculator";
import { retryWithExponentialBackoff, validateArticleCompleteness, withTimeout } from "./utils";
import { getOpenAICircuitBreaker } from "./circuit-breaker";
import { TokenUsageInfo } from "../../types/podcast";

/**
 * Detect language from transcript text
 * Uses a simple heuristic based on common words to identify the most likely language
 *
 * Supports: English, German, Spanish, French, Italian, Portuguese, Dutch, and more
 * Falls back to English if detection is uncertain
 */
function detectLanguage(text: string): string {
  const sample = text.slice(0, 1000).toLowerCase();
  const words = sample.split(/\s+/);

  // Language detection patterns
  const patterns = {
    en: ["the", "and", "is", "are", "in", "to", "of", "for", "with", "that", "this", "from", "was", "were", "been", "have", "has"],
    de: ["der", "die", "das", "und", "ist", "sind", "ein", "eine", "nicht", "auch", "von", "dem", "den", "des", "sich", "auf", "für", "mit", "wird", "werden"],
    es: ["el", "la", "de", "que", "y", "en", "un", "ser", "se", "no", "estar", "por", "con", "para", "como", "más", "los", "las"],
    fr: ["le", "de", "un", "être", "et", "à", "il", "avoir", "ne", "je", "son", "que", "se", "qui", "ce", "dans", "en", "du", "elle", "pour"],
    it: ["il", "di", "e", "che", "non", "un", "essere", "per", "con", "come", "più", "nel", "della", "dei", "anche", "questa"],
    pt: ["o", "de", "e", "que", "não", "um", "ser", "para", "com", "por", "mais", "os", "uma", "em", "no", "na"],
    nl: ["de", "het", "een", "van", "en", "in", "op", "dat", "die", "te", "voor", "niet", "met", "aan", "zijn", "wordt"]
  };

  // Count matches for each language
  const scores: Record<string, number> = {};
  for (const [lang, keywords] of Object.entries(patterns)) {
    scores[lang] = keywords.filter(word => words.includes(word)).length;
  }

  logger.info(`[OpenAI Article] Language detection scores:`, scores);

  // Find language with highest score
  const detectedLang = Object.entries(scores).reduce((best, [lang, score]) =>
    score > best.score ? { lang, score } : best,
    { lang: "en", score: scores.en }
  ).lang;

  logger.info(`[OpenAI Article] Detected language: ${detectedLang} (${getLanguageName(detectedLang)})`);

  return detectedLang;
}

/**
 * Get human-readable language name
 */
function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: "English",
    de: "German",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    pt: "Portuguese",
    nl: "Dutch"
  };
  return names[code] || code;
}

/**
 * Generate article from transcript using GPT-4o-mini
 *
 * This implements Stage 1 of the two-stage pipeline:
 * - Takes transcript text as input
 * - Generates 600-1000 word article in Markdown
 * - Returns article with SEO metadata (title, description, keywords)
 * - Uses structured output (JSON schema) for reliability
 * - Automatically detects and matches transcript language
 *
 * @param transcript - Text transcript from Whisper
 * @param model - Model to use ("gpt-4o-mini" or "gpt-4o")
 * @returns Article data with metadata and token usage
 */
export async function generateArticleFromTranscript(
  transcript: string,
  model: "gpt-4o" | "gpt-4o-mini" = "gpt-4o-mini"
): Promise<{
  markdown: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  tokenUsage: TokenUsageInfo;
}> {

  logger.info("=".repeat(80));
  logger.info(`[OpenAI Article] Starting article generation`);
  logger.info(`[OpenAI Article] Model: ${model}`);
  logger.info("=".repeat(80));

  const startTime = Date.now();

  try {
    const openai = getOpenAIClient();
    const circuitBreaker = getOpenAICircuitBreaker();

    logger.info(`[OpenAI Article] Transcript length: ${transcript.length} characters`);

    // Detect language from transcript (used for logging and quality assurance)
    const detectedLanguage = detectLanguage(transcript);
    logger.info(`[OpenAI Article] Processing with detected language: ${detectedLanguage}`);

    // Define article schema (OpenAI format)
    const articleSchema = {
      type: "object" as const,
      properties: {
        markdown: {
          type: "string" as const,
          description: "Complete article in Markdown format. Target 600-1000 words with proper # and ## headings."
        },
        title: {
          type: "string" as const,
          description: "SEO-optimized title. Maximum 60 characters."
        },
        metaDescription: {
          type: "string" as const,
          description: "Meta description for SEO. Must be between 100-160 characters."
        },
        keywords: {
          type: "array" as const,
          items: {
            type: "string" as const
          },
          description: "Array of 5-8 relevant SEO keywords.",
          minItems: 5,
          maxItems: 10
        }
      },
      required: ["markdown", "title", "metaDescription", "keywords"],
      additionalProperties: false // Enable strict mode
    };

    // Build language-neutral system instruction
    const systemInstruction = `You are a professional content writer for podcast teaser articles. Your goal is to make readers curious and motivate them to listen to the podcast. Write in the same language as the transcript provided.`;

    // Build universal multilingual prompt
    const userPrompt = `Write an SEO-optimized article (minimum 600 words, ideally 800–1000 words) based on the podcast transcript below.

CRITICAL REQUIREMENT: Write the ENTIRE article in the SAME LANGUAGE as the podcast transcript. Match the language exactly.

**Structure:**
- # Title
- Introduction (150–200 words)
- ## Main Topic 1 (150–200 words)
- ## Main Topic 2 (150–200 words)
- ## Main Topic 3 (150–200 words)
- ## Conclusion (100–150 words, with Call-to-Action)

**Style Guidelines:**
- Professional yet reader-friendly
- Intriguing without revealing everything
- Use phrases like "Learn more in the podcast…" (translated to match the transcript language)
- No single-sentence paragraphs
- Use Markdown formatting

**Output Format:**
Return a JSON object with these exact fields:
{
  "markdown": "<Article text in Markdown, in the same language as the transcript>",
  "title": "<SEO title, max 60 characters, in the same language as the transcript>",
  "metaDescription": "<Meta description, 100–160 characters, in the same language as the transcript>",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

**Podcast Transcript:**

${transcript}`;

    // Build messages array
    const messages: Array<{role: "system" | "user"; content: string}> = [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ];

    logger.info("[OpenAI Article] Sending request to OpenAI...");

    // Generate with protection layers (timeout + circuit breaker + retry)
    const completion = await withTimeout(
      async () => {
        return await circuitBreaker.execute(async () => {
          return await retryWithExponentialBackoff(async () => {
            return await openai.chat.completions.create({
              model: model,
              messages: messages,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "article_response",
                  strict: true,
                  schema: articleSchema
                }
              },
              max_tokens: 8192, // Plenty for 600-1000 word articles (~2000 tokens actual)
              temperature: 0.7, // Creative but focused
            });
          });
        });
      },
      undefined, // Use default timeout from utils (2 minutes)
      `Stage 1: Article Generation (${model})`
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`[OpenAI Article] ✅ Generation completed in ${duration}s`);

    // Check finish reason
    const finishReason = completion.choices[0]?.finish_reason;
    logger.info(`[OpenAI Article] finish_reason: ${finishReason}`);

    if (finishReason !== "stop") {
      logger.error(`[OpenAI Article] ❌ Non-stop finish_reason: ${finishReason}`);

      if (finishReason === "length") {
        logger.error(`[OpenAI Article] Hit max_tokens limit - article was truncated`);
        throw new Error(`[OpenAI Article] Article generation incomplete: MAX_TOKENS exceeded (length). The article was truncated before completion.`);
      } else if (finishReason === "content_filter") {
        logger.error(`[OpenAI Article] Content filter triggered`);
        throw new Error(`[OpenAI Article] Article generation incomplete: Content filter triggered. Content may violate policies.`);
      } else {
        logger.error(`[OpenAI Article] Unknown finish_reason: ${finishReason}`);
        throw new Error(`[OpenAI Article] Article generation incomplete: Unknown finish_reason '${finishReason}'. Expected 'stop'.`);
      }
    }

    // Parse response
    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("[OpenAI Article] No content in response");
    }

    logger.info(`[OpenAI Article] Response length: ${responseText.length} characters`);

    // Parse JSON
    let articleData: {
      markdown: string;
      title: string;
      metaDescription: string;
      keywords: string[];
    };

    try {
      articleData = JSON.parse(responseText);
    } catch (parseError: unknown) {
      const typedError = parseError instanceof Error ? parseError : new Error(String(parseError));
      logger.error(`[OpenAI Article] ❌ JSON parsing failed`);
      logger.error(`[OpenAI Article] Parse error: ${typedError.message}`);
      logger.error(`[OpenAI Article] Response preview (first 500 chars): ${responseText.slice(0, 500)}`);
      throw new Error(`[OpenAI Article] JSON parsing failed: ${typedError.message}`);
    }

    // Validate all required fields
    const requiredFields: Array<keyof typeof articleData> = ["markdown", "title", "metaDescription", "keywords"];
    const missingFields = requiredFields.filter(field => !articleData[field]);

    if (missingFields.length > 0) {
      logger.error(`[OpenAI Article] ❌ Missing required fields: ${missingFields.join(', ')}`);
      logger.error(`[OpenAI Article] Available fields: ${Object.keys(articleData).join(', ')}`);
      throw new Error(`[OpenAI Article] Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate article completeness
    validateArticleCompleteness(articleData.markdown, `Stage 1 (OpenAI ${model})`);

    // Calculate token usage and costs
    const usage = completion.usage!;
    const { costUSD, costEUR } = calculateOpenAICost(
      model,
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

    logger.info(`[OpenAI Article] 📊 Token Usage:`);
    logger.info(`[OpenAI Article]    - Input tokens: ${usage.prompt_tokens}`);
    logger.info(`[OpenAI Article]    - Output tokens: ${usage.completion_tokens}`);
    logger.info(`[OpenAI Article]    - Total tokens: ${usage.total_tokens}`);
    logger.info(`[OpenAI Article] 💰 Cost: $${costUSD.toFixed(6)} / €${costEUR.toFixed(6)}`);

    logger.info(`[OpenAI Article] ✅ Article generation successful`);
    logger.info(`[OpenAI Article] Article length: ${articleData.markdown.length} characters`);
    logger.info(`[OpenAI Article] Title: ${articleData.title}`);
    logger.info(`[OpenAI Article] Keywords: ${articleData.keywords.length} keywords`);

    logger.info("=".repeat(80));
    logger.info(`[OpenAI Article] ✅ Stage 1 Complete`);
    logger.info("=".repeat(80));

    return {
      markdown: articleData.markdown,
      title: articleData.title,
      metaDescription: articleData.metaDescription,
      keywords: articleData.keywords,
      tokenUsage,
    };

  } catch (error: unknown) {
    const typedError = error instanceof Error ? error : new Error(String(error));
    logger.error("=".repeat(80));
    logger.error(`[OpenAI Article] ❌ FAILED`);
    logger.error("=".repeat(80));
    logger.error(`Error message: ${typedError.message}`);
    logger.error(`Error type: ${typedError.constructor.name || 'Unknown'}`);
    throw typedError;
  }
}
