import * as logger from "firebase-functions/logger";
import { transcribeAudio } from "./transcription";
import { generateArticleFromTranscript } from "./article";
import { generateMetadataFromArticle } from "./metadata";
import { fixMetaDescription } from "./utils";
import { markdownToHtml, generateSlug } from "../../utils/metadata-generator";
import { BlogArticle, PodcastTokenUsage } from "../../types/podcast";

/**
 * TWO-STAGE OPENAI PROCESSING PIPELINE
 *
 * Architecture:
 * - Stage 0: GPT-4o-transcribe API → Audio transcription
 * - Stage 1: GPT-4o-mini → Article generation (with retry + GPT-4o fallback)
 * - Stage 2: GPT-4o-mini → Metadata generation
 *
 * Benefits:
 * - High reliability and cost efficiency
 * - No truncation issues (strict token limits)
 * - No over-generation (controlled output size)
 * - Industry-standard architecture
 *
 * @param storagePath - Cloud Storage path to audio file
 * @param mimeType - MIME type of audio (e.g., "audio/mpeg")
 * @param durationMinutes - Audio duration in minutes (optional, for cost estimation)
 * @returns Complete BlogArticle with metadata and token usage
 */
export async function processAudioWithOpenAI(
  storagePath: string,
  mimeType: string = "audio/mpeg",
  durationMinutes?: number
): Promise<BlogArticle> {
  try {
    logger.info("=".repeat(80));
    logger.info("[OpenAI Pipeline] Starting audio processing");
    logger.info("[OpenAI Pipeline] Stage 0: GPT-4o-transcribe Transcription");
    logger.info("[OpenAI Pipeline] Stage 1: GPT-4o-mini Article Generation");
    logger.info("[OpenAI Pipeline] Stage 2: GPT-4o-mini Metadata Generation");
    logger.info("=".repeat(80));

    const pipelineStartTime = Date.now();

    // ========================================
    // STAGE 0: Transcribe Audio with GPT-4o-transcribe
    // ========================================
    logger.info("\n[OpenAI Pipeline] STAGE 0: Transcribing audio with GPT-4o-transcribe...");
    const transcription = await transcribeAudio(storagePath, durationMinutes);

    logger.info(`[OpenAI Pipeline] ✅ Stage 0 complete: Transcription (${transcription.transcript.length} chars)`);
    logger.info(`[OpenAI Pipeline] 💰 Transcription cost: $${transcription.costUSD.toFixed(6)}`);

    // ========================================
    // STAGE 1: Generate Article from Transcript
    // ========================================
    logger.info("\n[OpenAI Pipeline] STAGE 1: Generating article from transcript...");

    const articleData = await generateArticleFromTranscript(transcription.transcript);

    logger.info(`[OpenAI Pipeline] ✅ Stage 1 complete: Article generated (${articleData.markdown.length} chars)`);
    logger.info(`[OpenAI Pipeline] 💰 Article cost: $${articleData.tokenUsage.costUSD.toFixed(6)}`);

    // Auto-fix metaDescription if needed (ensure 100-160 characters)
    const fixedMetaDescription = fixMetaDescription(articleData.metaDescription);
    if (fixedMetaDescription !== articleData.metaDescription) {
      logger.info(`[OpenAI Pipeline] 🔧 Auto-fixed metaDescription: ${articleData.metaDescription.length} → ${fixedMetaDescription.length} chars`);
      articleData.metaDescription = fixedMetaDescription;
    }

    // ========================================
    // STAGE 2: Generate Metadata from Article
    // ========================================
    logger.info("\n[OpenAI Pipeline] STAGE 2: Generating metadata from article...");

    const metadataResult = await generateMetadataFromArticle(
      articleData.markdown,
      articleData.title
    );

    logger.info(`[OpenAI Pipeline] ✅ Stage 2 complete: Metadata generated`);
    logger.info(`[OpenAI Pipeline] 💰 Metadata cost: $${metadataResult.tokenUsage.costUSD.toFixed(6)}`);

    // ========================================
    // POST-PROCESSING: Generate slug and HTML
    // ========================================
    logger.info("\n[OpenAI Pipeline] POST-PROCESSING: Generating slug and HTML...");

    const slug = generateSlug(articleData.title);
    const html = markdownToHtml(articleData.markdown);

    logger.info(`[OpenAI Pipeline] ✅ Post-processing complete`);
    logger.info(`[OpenAI Pipeline] Slug: ${slug}`);

    // ========================================
    // CALCULATE TOTAL COSTS
    // ========================================
    const totalCostUSD =
      transcription.costUSD +
      articleData.tokenUsage.costUSD +
      metadataResult.tokenUsage.costUSD;

    const totalCostEUR =
      transcription.costEUR +
      articleData.tokenUsage.costEUR +
      metadataResult.tokenUsage.costEUR;

    const totalTokens =
      articleData.tokenUsage.totalTokens +
      metadataResult.tokenUsage.totalTokens;

    const pipelineDuration = ((Date.now() - pipelineStartTime) / 1000).toFixed(2);

    logger.info("\n" + "=".repeat(80));
    logger.info("[OpenAI Pipeline] 📊 PIPELINE SUMMARY");
    logger.info("=".repeat(80));
    logger.info("[OpenAI Pipeline] 💰 Cost Breakdown:");
    logger.info(`[OpenAI Pipeline]    - GPT-4o-transcribe:     $${transcription.costUSD.toFixed(6)}`);
    logger.info(`[OpenAI Pipeline]    - Article generation:    $${articleData.tokenUsage.costUSD.toFixed(6)}`);
    logger.info(`[OpenAI Pipeline]    - Metadata generation:   $${metadataResult.tokenUsage.costUSD.toFixed(6)}`);
    logger.info(`[OpenAI Pipeline]    - TOTAL:                 $${totalCostUSD.toFixed(6)} / €${totalCostEUR.toFixed(6)}`);
    logger.info("[OpenAI Pipeline] 📊 Token Usage:");
    logger.info(`[OpenAI Pipeline]    - Total tokens: ${totalTokens}`);
    logger.info("[OpenAI Pipeline] ⏱️  Pipeline Duration:");
    logger.info(`[OpenAI Pipeline]    - Total time: ${pipelineDuration}s`);
    logger.info("[OpenAI Pipeline] 📄 Output:");
    logger.info(`[OpenAI Pipeline]    - Title: ${articleData.title}`);
    logger.info(`[OpenAI Pipeline]    - Slug: ${slug}`);
    logger.info(`[OpenAI Pipeline]    - Article: ${articleData.markdown.length} chars`);
    logger.info(`[OpenAI Pipeline]    - Keywords: ${articleData.keywords.length} keywords`);
    logger.info(`[OpenAI Pipeline]    - Metadata: schemaOrg + openGraph + 6 social platforms`);
    logger.info("=".repeat(80));
    logger.info("[OpenAI Pipeline] ✅ PIPELINE COMPLETE");
    logger.info("=".repeat(80));

    // Construct token usage object
    const tokenUsage: PodcastTokenUsage = {
      stage1: {
        inputTokens: articleData.tokenUsage.inputTokens,
        outputTokens: articleData.tokenUsage.outputTokens,
        totalTokens: articleData.tokenUsage.totalTokens,
        costUSD: articleData.tokenUsage.costUSD,
        costEUR: articleData.tokenUsage.costEUR,
        audioCostUSD: transcription.costUSD,
        audioCostEUR: transcription.costEUR,
      },
      stage2: {
        inputTokens: metadataResult.tokenUsage.inputTokens,
        outputTokens: metadataResult.tokenUsage.outputTokens,
        totalTokens: metadataResult.tokenUsage.totalTokens,
        costUSD: metadataResult.tokenUsage.costUSD,
        costEUR: metadataResult.tokenUsage.costEUR,
      },
      total: {
        totalTokens: totalTokens,
        totalCostUSD: totalCostUSD,
        totalCostEUR: totalCostEUR,
      },
      calculatedAt: new Date(),
    };

    // Return complete BlogArticle
    return {
      title: articleData.title,
      slug: slug,
      metaDescription: fixedMetaDescription,
      keywords: articleData.keywords,
      markdown: articleData.markdown,
      html: html,
      schemaOrg: metadataResult.metadata.schemaOrg,
      openGraph: metadataResult.metadata.openGraph,
      socialMedia: metadataResult.metadata.socialMedia,
      tokenUsage: tokenUsage,
    };

  } catch (error: unknown) {
    const typedError = error instanceof Error ? error : new Error(String(error));
    logger.error("=".repeat(80));
    logger.error("[OpenAI Pipeline] ❌ PIPELINE FAILED");
    logger.error("=".repeat(80));
    logger.error(`Error message: ${typedError.message}`);
    logger.error(`Error type: ${typedError.constructor.name || 'Unknown'}`);
    logger.error(`Error stack: ${typedError.stack || 'No stack trace'}`);
    throw typedError;
  }
}

/**
 * Export individual services for testing and direct use
 */
export { transcribeAudio } from "./transcription";
export { generateArticleFromTranscript } from "./article";
export { generateMetadataFromArticle } from "./metadata";
export { getOpenAIClient } from "./client";
