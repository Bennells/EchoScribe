import * as logger from "firebase-functions/logger";
import type { BlogArticle, PodcastTokenUsage } from "../../types/podcast";
import { markdownToHtml, generateSlug } from "../../utils/metadata-generator";
import { generateArticleDirectlyFromAudio } from "./article";
import { generateMetadataFromArticle } from "./metadata";
import { fixMetaDescription } from "./utils";
import { getVertexAIClient } from "./client";

/**
 * Main Two-Stage Audio Processing Pipeline
 *
 * This is the primary entry point for processing podcast audio into a complete
 * blog article with full SEO and social media metadata.
 *
 * Pipeline:
 * 1. Stage 1: Audio → Teaser Article (with basic metadata)
 * 2. Stage 2: Article → Complete Metadata (SEO + social media)
 * 3. App Generation: Markdown → HTML + Slug
 *
 * Benefits of two-stage approach:
 * - Dedicated token budgets for article quality and metadata completeness
 * - Metadata can be regenerated without re-processing audio
 * - Better error isolation and debugging
 * - More efficient use of Gemini's capabilities
 *
 * @param storagePath - Cloud Storage path (e.g., "podcasts/userId/file.mp3")
 * @param mimeType - MIME type of audio file (default: "audio/mpeg")
 * @param durationMinutes - Duration of the podcast in minutes
 * @returns Complete blog article with all metadata
 */
export async function processAudioTwoStage(
  storagePath: string,
  mimeType: string = "audio/mpeg",
  durationMinutes?: number
): Promise<BlogArticle> {
  try {
    logger.info("=".repeat(80));
    logger.info("[Two-Stage Pipeline] Starting audio processing");
    logger.info("[Two-Stage Pipeline] Stage 1: Audio → Teaser Article | Stage 2: Article → Metadata");
    logger.info("=".repeat(80));

    const pipelineStartTime = Date.now();

    // ========================================
    // STAGE 1: Generate Teaser Article from Audio
    // ========================================
    logger.info("\n[Two-Stage] STAGE 1: Generating teaser article from audio...");
    const articleData = await generateArticleDirectlyFromAudio(storagePath, mimeType, durationMinutes);
    logger.info(`[Two-Stage] ✅ Stage 1 complete: Article generated (${articleData.markdown.length} chars)`);

    // Auto-fix metaDescription if needed
    const fixedMetaDescription = fixMetaDescription(articleData.metaDescription);
    if (fixedMetaDescription !== articleData.metaDescription) {
      logger.info(`[Two-Stage] 🔧 Auto-fixed metaDescription: ${articleData.metaDescription.length} → ${fixedMetaDescription.length} chars`);
      articleData.metaDescription = fixedMetaDescription;
    }

    // ========================================
    // STAGE 2: Generate Metadata from Article
    // ========================================
    logger.info("\n[Two-Stage] STAGE 2: Generating metadata from article...");
    const metadata = await generateMetadataFromArticle(
      articleData.markdown,
      articleData.title,
      articleData.metaDescription
    );
    logger.info(`[Two-Stage] ✅ Stage 2 complete: Metadata generated`);

    // ========================================
    // APP GENERATION: HTML + Slug
    // ========================================
    logger.info("\n[App Generation] Converting markdown → HTML and generating slug");
    const html = markdownToHtml(articleData.markdown);
    const slug = generateSlug(articleData.title);

    logger.info(`[App Generation] ✅ HTML generated: ${html.length} chars`);
    logger.info(`[App Generation] ✅ Slug generated: ${slug}`);

    // ========================================
    // COMBINE RESULTS & TOKEN USAGE
    // ========================================
    const totalDuration = ((Date.now() - pipelineStartTime) / 1000).toFixed(2);

    // Combine token usage from both stages
    const combinedTokenUsage: PodcastTokenUsage = {
      stage1: articleData.tokenUsage,
      stage2: metadata.tokenUsage,
      total: {
        totalTokens: articleData.tokenUsage.totalTokens + metadata.tokenUsage.totalTokens,
        totalCostUSD: articleData.tokenUsage.costUSD + metadata.tokenUsage.costUSD,
        totalCostEUR: articleData.tokenUsage.costEUR + metadata.tokenUsage.costEUR,
      },
      calculatedAt: new Date(),
    };

    logger.info("\n" + "=".repeat(80));
    logger.info(`[Two-Stage Pipeline] ✅ COMPLETE | Total time: ${totalDuration}s`);
    logger.info("=".repeat(80));
    logger.info(`[Two-Stage Pipeline] 💰 Total Cost:`);
    logger.info(`  - Stage 1: ${articleData.tokenUsage.totalTokens} tokens | $${articleData.tokenUsage.costUSD.toFixed(6)} / €${articleData.tokenUsage.costEUR.toFixed(6)}`);
    logger.info(`  - Stage 2: ${metadata.tokenUsage.totalTokens} tokens | $${metadata.tokenUsage.costUSD.toFixed(6)} / €${metadata.tokenUsage.costEUR.toFixed(6)}`);
    logger.info(`  - Combined: ${combinedTokenUsage.total.totalTokens} tokens | $${combinedTokenUsage.total.totalCostUSD.toFixed(6)} / €${combinedTokenUsage.total.totalCostEUR.toFixed(6)}`);
    logger.info("=".repeat(80));

    const blogArticle: BlogArticle = {
      title: articleData.title,
      slug: slug,
      metaDescription: articleData.metaDescription,
      keywords: articleData.keywords,
      markdown: articleData.markdown,
      html: html,
      schemaOrg: metadata.schemaOrg,
      openGraph: metadata.openGraph,
      socialMedia: metadata.socialMedia,
      showNotes: undefined,
      tokenUsage: combinedTokenUsage,
    };

    logger.info("[Two-Stage Pipeline] Final results:");
    logger.info(`  - Article: ${blogArticle.markdown.length} chars`);
    logger.info(`  - Title: ${blogArticle.title}`);
    logger.info(`  - Slug: ${blogArticle.slug}`);
    logger.info(`  - Metadata: schemaOrg + openGraph + 6 social platforms`);

    return blogArticle;

  } catch (error: any) {
    logger.error("=".repeat(80));
    logger.error("[Two-Stage Pipeline] ❌ FAILED");
    logger.error("=".repeat(80));
    logger.error(`Error message: ${error.message}`);
    logger.error(`Error type: ${error?.constructor?.name || 'Unknown'}`);
    logger.error(`Error code: ${error?.code || '(no code)'}`);
    throw error;
  }
}

/**
 * Test Vertex AI connection
 *
 * Simple health check to verify Vertex AI client can connect and make requests.
 * Useful for debugging connection issues.
 *
 * @returns true if connection successful, false otherwise
 */
export async function testVertexAIConnection(): Promise<boolean> {
  try {
    const vertexAI = getVertexAIClient();
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

// Re-export public APIs
export { generateArticleDirectlyFromAudio } from "./article";
export { generateMetadataFromArticle } from "./metadata";
export { getVertexAIClient, resetVertexAIClient } from "./client";
