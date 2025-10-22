import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { processAudioWithGemini } from "../services/gemini";
import { generateSlug } from "../utils/prompts";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

export async function processPodcast(podcastId: string, storagePath: string) {
  logger.info(`Processing podcast ${podcastId} from ${storagePath}`);

  try {
    // Update status to processing
    await db.collection("podcasts").doc(podcastId).update({
      status: "processing",
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Get podcast data
    const podcastDoc = await db.collection("podcasts").doc(podcastId).get();
    if (!podcastDoc.exists) {
      throw new Error("Podcast document not found");
    }

    const podcastData = podcastDoc.data();
    if (!podcastData) {
      throw new Error("Podcast data is empty");
    }

    // Download audio file from Storage
    logger.info("Downloading audio file...");
    const file = bucket.file(storagePath);
    const [audioBuffer] = await file.download();
    logger.info(`Downloaded ${audioBuffer.length} bytes`);

    // Process with Gemini
    logger.info("Sending to Gemini for processing...");
    const article = await processAudioWithGemini(audioBuffer);
    logger.info("Article generated successfully");

    // Ensure slug is generated
    if (!article.slug) {
      article.slug = generateSlug(article.title);
    }

    // Save article to Firestore
    const articleRef = await db.collection("articles").add({
      podcastId,
      userId: podcastData.userId,
      title: article.title,
      slug: article.slug,
      metaDescription: article.metaDescription,
      keywords: article.keywords || [],
      contentMarkdown: article.markdown,
      contentHTML: article.html,
      schemaOrgMarkup: article.schemaOrg || {},
      openGraphTags: article.openGraph || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Article created: ${articleRef.id}`);

    // Update podcast status to completed
    await db.collection("podcasts").doc(podcastId).update({
      status: "completed",
      articleId: articleRef.id,
      processingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Podcast ${podcastId} processing completed`);
  } catch (error: any) {
    logger.error(`Error processing podcast ${podcastId}:`, error);

    // Update status to error
    await db.collection("podcasts").doc(podcastId).update({
      status: "error",
      errorMessage: error.message || "Unknown error",
      errorAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}
