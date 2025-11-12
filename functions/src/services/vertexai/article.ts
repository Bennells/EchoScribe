import { SchemaType } from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { AUDIO_TO_TEASER_ARTICLE_PROMPT } from "../../utils/prompts";
import { getVertexAIClient } from "./client";
import { retryWithExponentialBackoff, validateArticleCompleteness, withTimeout } from "./utils";
import { TokenUsageInfo } from "../../types/podcast";
import { calculateTextTokenCost, calculateAudioInputCost } from "./cost-calculator";
import { getVertexAICircuitBreaker } from "./circuit-breaker";

/**
 * STAGE 1: Generate Teaser Article from Audio
 *
 * Uses Gemini 2.5 Flash's native audio understanding to generate a teaser article
 * that introduces topics and motivates listeners to consume the podcast.
 *
 * Strategy: Create curiosity, don't replace the podcast!
 * - Introduces main topics and contextualizes them
 * - Mentions interesting facts/questions but doesn't reveal everything
 * - Uses teaser techniques and CTAs
 * - Realistic word counts: 500-1200 words based on duration
 *
 * @param storagePath - Cloud Storage path (e.g., "podcasts/userId/file.mp3")
 * @param mimeType - MIME type of audio file (default: "audio/mpeg")
 * @param durationMinutes - Duration of the podcast in minutes
 * @returns Article with basic metadata (title, description, keywords)
 */
export async function generateArticleDirectlyFromAudio(
  storagePath: string,
  mimeType: string = "audio/mpeg",
  durationMinutes?: number
): Promise<{
  markdown: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  tokenUsage: TokenUsageInfo & { audioCostUSD: number; audioCostEUR: number };
}> {
  const MAX_ATTEMPTS = 2; // Try up to 2 times if article is too short
  let lastError: Error | null = null;
  let previousArticle: { markdown: string; wordCount: number } | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      logger.info("=".repeat(80));
      logger.info(`[Direct Audio → Article] Starting article generation (Attempt ${attempt}/${MAX_ATTEMPTS})`);
      logger.info("=".repeat(80));

      const result = await generateArticleAttempt(storagePath, mimeType, durationMinutes, attempt, previousArticle);

      // Success! Return the result
      if (attempt > 1) {
        logger.info(`[Direct] ✅ Article generation successful after ${attempt} attempts`);
      }
      return result;

    } catch (error: unknown) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      lastError = typedError;

      // Check if this is a word count error
      const isWordCountError = typedError.message?.includes('too short') ||
                                typedError.message?.includes('words') ||
                                typedError.message?.includes('word count');

      if (isWordCountError && attempt < MAX_ATTEMPTS) {
        logger.warn(`[Direct] ⚠️ Attempt ${attempt} produced article that's too short`);

        // Extract word count from error message if possible
        const wordCountMatch = typedError.message.match(/(\d+)\s+words/);
        const actualWordCount = wordCountMatch ? parseInt(wordCountMatch[1]) : 0;

        // Try to get the article from the error context
        // We'll need to capture this in the attempt function
        if ((error as any).articleData) {
          previousArticle = {
            markdown: (error as any).articleData.markdown,
            wordCount: actualWordCount
          };
          logger.info(`[Direct] Captured previous article (${actualWordCount} words) for refinement`);
        }

        logger.warn(`[Direct] Retrying with article refinement (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`);
        continue;
      }

      // For non-word-count errors or last attempt, throw immediately
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error("[Direct] Failed to generate article after all attempts");
}

/**
 * Internal function to attempt article generation
 */
async function generateArticleAttempt(
  storagePath: string,
  mimeType: string,
  durationMinutes: number | undefined,
  attempt: number,
  previousArticle?: { markdown: string; wordCount: number }
): Promise<{
  markdown: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  tokenUsage: TokenUsageInfo & { audioCostUSD: number; audioCostEUR: number };
}> {
  try {

    // Get Vertex AI client
    const vertexAI = getVertexAIClient();

    // Construct Cloud Storage URI
    const bucketName = admin.storage().bucket().name;
    const audioUri = `gs://${bucketName}/${storagePath}`;

    logger.info(`[Direct] Audio URI: ${audioUri}`);
    logger.info(`[Direct] MIME type: ${mimeType}`);
    if (durationMinutes) {
      logger.info(`[Direct] Duration: ${durationMinutes} minutes`);
    }

    // Define article schema with explicit requirements (Stage 1: article + basic SEO metadata)
    const articleSchema = {
      type: SchemaType.OBJECT,
      properties: {
        markdown: {
          type: SchemaType.STRING,
          description: "Complete teaser article in Markdown format. MUST be 600-1000 words. CRITICAL: MUST use proper Markdown syntax with one H1 title starting with single # (e.g., '# Titel'), and at least 3 H2 sections each starting with double ## (e.g., '## Überschrift'). Each H2 section must have multiple paragraphs. MUST end with complete sentence and punctuation. NO truncation allowed. Example structure: '# Main Title\\n\\nIntro paragraph...\\n\\n## First Topic\\n\\nParagraph 1...\\n\\nParagraph 2...\\n\\n## Second Topic\\n\\nParagraph 1...'"
        },
        title: {
          type: SchemaType.STRING,
          description: "SEO-optimized title. Maximum 60 characters. Should be compelling and keyword-rich."
        },
        metaDescription: {
          type: SchemaType.STRING,
          description: "Meta description for SEO. Must be between 100-160 characters. Should include main keywords and call-to-action."
        },
        keywords: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.STRING
          },
          description: "Array of 5-8 relevant SEO keywords. Choose keywords that appear in the article and are search-relevant.",
          minItems: 5,
          maxItems: 10
        }
      },
      required: ["markdown", "title", "metaDescription", "keywords"]
    };

    // Create model for teaser article generation
    const articleModel = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: {
        role: "system",
        parts: [{
          text: `Du bist ein professioneller Content-Writer für Podcast-Teaser-Artikel. Dein Ziel ist es, Leser neugierig zu machen und zum Podcast-Hören zu motivieren.`
        }]
      },
      generationConfig: {
        maxOutputTokens: 65536, // Maximum for Gemini 2.5 Flash - prevents token limit errors
        temperature: 0.7, // Creative but focused
        topP: 0.9,
        topK: 40,
        responseSchema: articleSchema,
        responseMimeType: "application/json",
      },
    });

    // Build prompt and request based on whether this is a retry with previous article
    let articleRequest;

    if (attempt > 1 && previousArticle) {
      // RETRY WITH REFINEMENT: Multi-turn conversation approach
      logger.info(`[Direct] Using multi-turn refinement with previous article (${previousArticle.wordCount} words)`);

      const refinementPrompt = `${AUDIO_TO_TEASER_ARTICLE_PROMPT}

⚠️⚠️⚠️ **KRITISCHE WARNUNG - DIES IST EIN REFINEMENT-VERSUCH** ⚠️⚠️⚠️

**DEIN VORHERIGER ARTIKEL WAR ZU KURZ:**
- Du hast nur ${previousArticle.wordCount} Wörter geschrieben
- Das Minimum ist 600 Wörter - du bist ${600 - previousArticle.wordCount} Wörter unter dem Minimum!

**HIER IST DEIN VORHERIGER ARTIKEL:**

\`\`\`markdown
${previousArticle.markdown}
\`\`\`

**AUFGABE - ERWEITERE DIESEN ARTIKEL:**

1. **Behalte die guten Teile** - Der Grundaufbau und gute Inhalte können bleiben
2. **Erweitere dünne Abschnitte** - Jeder Abschnitt braucht MINDESTENS 150-200 Wörter
3. **Füge mehr Details hinzu:**
   - Erweitere Erklärungen mit mehr Kontext
   - Füge konkrete Beispiele und Zitate aus dem Podcast hinzu
   - Vertiefe interessante Aspekte
   - Stelle Zusammenhänge her
4. **Füge fehlende Abschnitte hinzu** falls nötig
5. **Stelle sicher: MINDESTENS 600 Wörter im finalen Artikel!**

**WICHTIG:**
- Dies ist KEINE Zusammenfassung - erweitere den Artikel ausführlich!
- Behalte alle SEO-Optimierungen (Title, Meta Description, Keywords)
- Der erweiterte Artikel muss vollständig und abgeschlossen sein
- Zähle deine Wörter während des Schreibens!

Dies ist deine LETZTE CHANCE. Der Artikel MUSS jetzt mindestens 600 Wörter haben!`;

      // Multi-turn request: Show previous generation in conversation history
      articleRequest = {
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: audioUri,
                  mimeType: mimeType,
                },
              },
              {
                text: AUDIO_TO_TEASER_ARTICLE_PROMPT,
              },
            ],
          },
          {
            role: "model",
            parts: [
              {
                text: JSON.stringify({
                  markdown: previousArticle.markdown,
                  title: "(previous title)",
                  metaDescription: "(previous meta)",
                  keywords: ["(previous)", "keywords)"]
                }),
              },
            ],
          },
          {
            role: "user",
            parts: [
              {
                text: refinementPrompt,
              },
            ],
          },
        ],
      };

    } else {
      // FIRST ATTEMPT or retry without previous article: Simple single-turn request
      const promptText = AUDIO_TO_TEASER_ARTICLE_PROMPT;

      articleRequest = {
        contents: [{
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: audioUri,
                mimeType: mimeType,
              },
            },
            {
              text: promptText,
            },
          ],
        }],
      };
    }

    logger.info("[Direct] Sending audio to Gemini Flash for direct article generation (STREAMING)...");
    const startTime = Date.now();

    // Get circuit breaker instance
    const circuitBreaker = getVertexAICircuitBreaker();

    // Execute with timeout + circuit breaker for complete protection
    const streamingResult = await withTimeout(
      async () => {
        return await circuitBreaker.execute(async () => {
          return await retryWithExponentialBackoff(async () => {
            return await articleModel.generateContentStream(articleRequest);
          });
        });
      },
      undefined, // Use default timeout from constants (45 min)
      "Stage 1: Article Generation"
    );

    // Process streaming chunks for progress monitoring only
    // Note: We'll use the aggregated response for actual content (more reliable with JSON schema)
    let chunkCount = 0;
    let totalCharsReceived = 0;
    let lastLogTime = Date.now();

    logger.info("[Direct] 🌊 Streaming started - receiving chunks...");

    for await (const chunk of streamingResult.stream) {
      chunkCount++;

      // Calculate chunk size for progress monitoring
      let chunkSize = 0;
      if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
        for (const part of chunk.candidates[0].content.parts) {
          if (part.text) {
            chunkSize += part.text.length;
          }
        }
      }

      totalCharsReceived += chunkSize;

      // Log progress summary every 10 chunks or 5 seconds
      const now = Date.now();
      if (chunkCount % 10 === 0 || (now - lastLogTime) > 5000) {
        const elapsed = ((now - startTime) / 1000).toFixed(1);
        logger.info(`[Direct] 📊 Progress: ${chunkCount} chunks, ~${totalCharsReceived} chars, ${elapsed}s elapsed`);
        lastLogTime = now;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`[Direct] ⏱️ Streaming completed in ${duration}s | ${chunkCount} total chunks`);

    // Get aggregated response - this contains the COMPLETE, properly formatted response
    // With JSON schema, the aggregated response is more reliable than chunk collection
    const response = await streamingResult.response;
    const candidates = response.candidates;

    // Calculate and log token usage with costs
    let tokenUsage: TokenUsageInfo & { audioCostUSD: number; audioCostEUR: number };

    if (response.usageMetadata) {
      const usage = response.usageMetadata;
      const promptTokens = usage.promptTokenCount || 0;
      const candidatesTokens = usage.candidatesTokenCount || 0;
      const totalTokens = usage.totalTokenCount || 0;

      logger.info(`[Direct] 📊 Token Usage:`);
      logger.info(`[Direct]    - Prompt tokens: ${promptTokens}`);
      logger.info(`[Direct]    - Candidates tokens: ${candidatesTokens}`);
      logger.info(`[Direct]    - Total tokens: ${totalTokens}`);

      // Calculate costs
      const textCost = calculateTextTokenCost({
        promptTokens,
        candidatesTokens,
        totalTokens,
      });

      const audioCost = durationMinutes
        ? calculateAudioInputCost(durationMinutes)
        : { costUSD: 0, costEUR: 0 };

      const totalCostUSD = textCost.totalCostUSD + audioCost.costUSD;
      const totalCostEUR = textCost.totalCostEUR + audioCost.costEUR;

      logger.info(`[Direct] 💰 Cost Estimate:`);
      logger.info(`[Direct]    - Text tokens: $${textCost.totalCostUSD.toFixed(6)} / €${textCost.totalCostEUR.toFixed(6)}`);
      if (durationMinutes) {
        logger.info(`[Direct]    - Audio (${durationMinutes}min): $${audioCost.costUSD.toFixed(6)} / €${audioCost.costEUR.toFixed(6)}`);
      }
      logger.info(`[Direct]    - Total: $${totalCostUSD.toFixed(6)} / €${totalCostEUR.toFixed(6)}`);

      tokenUsage = {
        inputTokens: promptTokens,
        outputTokens: candidatesTokens,
        totalTokens,
        costUSD: totalCostUSD,
        costEUR: totalCostEUR,
        audioCostUSD: audioCost.costUSD,
        audioCostEUR: audioCost.costEUR,
      };
    } else {
      logger.warn(`[Direct] ⚠️ No usage metadata available - cannot calculate costs`);
      // Fallback with zero values
      tokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUSD: 0,
        costEUR: 0,
        audioCostUSD: 0,
        audioCostEUR: 0,
      };
    }

    if (!candidates || candidates.length === 0) {
      throw new Error("[Direct] No candidates in response");
    }

    // Check finishReason - MUST be STOP for complete generation
    const finishReason = candidates[0]?.finishReason;
    logger.info(`[Direct] finishReason: ${finishReason}`);

    if (finishReason !== "STOP") {
      logger.error(`[Direct] ❌ Non-STOP finishReason: ${finishReason}`);
      logger.error(`[Direct] Article generation incomplete - rejecting response`);

      // Log detailed reason for debugging
      if (finishReason === "MAX_TOKENS") {
        logger.error(`[Direct] Hit token limit - article was truncated`);
        throw new Error("[Direct] Article generation incomplete: MAX_TOKENS exceeded. The article was truncated before completion.");
      } else if (finishReason === "SAFETY") {
        logger.error(`[Direct] Safety filters triggered`);
        throw new Error("[Direct] Article generation incomplete: SAFETY filters triggered. Content may violate safety policies.");
      } else if (finishReason === "RECITATION") {
        logger.error(`[Direct] Recitation detected`);
        throw new Error("[Direct] Article generation incomplete: RECITATION detected. Content may contain copyrighted material.");
      } else {
        logger.error(`[Direct] Unknown finishReason: ${finishReason}`);
        throw new Error(`[Direct] Article generation incomplete: Unknown finishReason '${finishReason}'. Expected 'STOP'.`);
      }
    }

    // Extract complete response text from aggregated response
    // This is the authoritative source for JSON schema responses
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

    if (!responseText) {
      throw new Error("[Direct] No text content in response");
    }

    logger.info(`[Direct] Final response length: ${responseText.length} characters`);

    // Validate JSON structure
    const trimmed = responseText.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
      logger.error(`[Direct] ❌ Incomplete JSON response`);
      logger.error(`[Direct] Response starts with: ${trimmed.slice(0, 100)}`);
      logger.error(`[Direct] Response ends with: ${trimmed.slice(-100)}`);
      logger.error(`[Direct] Full response length: ${trimmed.length} characters`);

      // Log full response if it's short enough
      if (trimmed.length < 2000) {
        logger.error(`[Direct] Full response: ${trimmed}`);
      }

      throw new Error("[Direct] Incomplete JSON response - check logs for details");
    }

    // Parse JSON with error handling
    let articleData;
    try {
      articleData = JSON.parse(trimmed);
    } catch (parseError: unknown) {
      const typedError = parseError instanceof Error ? parseError : new Error(String(parseError));
      logger.error(`[Direct] ❌ JSON parsing failed`);
      logger.error(`[Direct] Parse error: ${typedError.message}`);
      logger.error(`[Direct] Response preview (first 500 chars): ${trimmed.slice(0, 500)}`);
      logger.error(`[Direct] Response preview (last 500 chars): ${trimmed.slice(-500)}`);
      throw new Error(`[Direct] JSON parsing failed: ${typedError.message}`);
    }

    // Validate all required fields are present
    const requiredFields = ["markdown", "title", "metaDescription", "keywords"];
    const missingFields = requiredFields.filter(field => !articleData[field]);

    if (missingFields.length > 0) {
      logger.error(`[Stage 1] ❌ Missing required fields: ${missingFields.join(', ')}`);
      logger.error(`[Stage 1] Available fields: ${Object.keys(articleData).join(', ')}`);
      throw new Error(`[Stage 1] Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate article completeness and capture article data in error if validation fails
    try {
      validateArticleCompleteness(articleData.markdown, "Stage 1");
    } catch (validationError: unknown) {
      // Attach article data to error so we can use it for retry refinement
      const typedError = validationError instanceof Error ? validationError : new Error(String(validationError));
      (typedError as any).articleData = articleData;
      throw typedError;
    }

    logger.info(`[Stage 1] ✅ Teaser article generation successful`);
    logger.info(`[Stage 1] Article length: ${articleData.markdown.length} characters`);
    logger.info(`[Stage 1] Title: ${articleData.title}`);
    logger.info(`[Stage 1] Keywords: ${articleData.keywords.length} keywords`);

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
    logger.error(`[Stage 1: Article Generation - Attempt ${attempt}] ❌ FAILED`);
    logger.error("=".repeat(80));
    logger.error(`Error message: ${typedError.message}`);
    logger.error(`Error type: ${typedError.constructor.name || 'Unknown'}`);
    logger.error(`Error code: ${(typedError as any).code || '(no code)'}`);
    throw typedError;
  }
}
