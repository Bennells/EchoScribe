import { GoogleGenerativeAI } from "@google/generative-ai";
import * as logger from "firebase-functions/logger";
import { BLOG_GENERATION_PROMPT } from "../utils/prompts";

function getApiKey(): string {
  // Firebase mounts secrets as environment variables in Cloud Run
  // So we can just use process.env for both deployed and local

  if (process.env.GEMINI_API_KEY) {
    const source = process.env.NODE_ENV === 'production'
      ? 'Secret Manager (via environment variable)'
      : 'local .env.local file';
    logger.info(`Using GEMINI_API_KEY from ${source}`);
    return process.env.GEMINI_API_KEY;
  }

  throw new Error("GEMINI_API_KEY not configured - please set up Secret Manager or .env.local");
}

let genAI: GoogleGenerativeAI;

export interface BlogArticle {
  title: string;
  slug: string;
  metaDescription: string;
  keywords: string[];
  markdown: string;
  html: string;
  schemaOrg: Record<string, any>;
  openGraph: Record<string, string>;
}

export async function processAudioWithGemini(audioBuffer: Buffer): Promise<BlogArticle> {
  try {
    logger.info("=".repeat(80));
    logger.info("[Gemini] Starting audio processing with Gemini");

    // Initialize genAI if not already done
    if (!genAI) {
      logger.info("[Gemini] Initializing Gemini API client...");
      try {
        const apiKey = getApiKey();
        genAI = new GoogleGenerativeAI(apiKey);
        logger.info("[Gemini] ✅ Gemini API client initialized successfully");
      } catch (error: any) {
        logger.error("[Gemini] ❌ Failed to initialize Gemini API client:", {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    logger.info("[Gemini] Sending audio to Gemini API...", {
      audioSize: audioBuffer.length,
      audioSizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
      model: "gemini-2.5-flash",
    });

    // Send audio directly to Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/mp3",
          data: audioBuffer.toString("base64"),
        },
      },
      { text: BLOG_GENERATION_PROMPT },
    ]);

    const response = result.response;
    const text = response.text();

    logger.info("[Gemini] ✅ Received response from Gemini", {
      responseLength: text.length,
      responseLengthKB: (text.length / 1024).toFixed(2),
    });

    // Parse JSON response
    let article: BlogArticle;
    try {
      // Step 1: Remove Markdown code blocks (```json ... ```)
      let cleanText = text.trim();
      cleanText = cleanText.replace(/^```json\s*/i, ""); // Remove opening ```json
      cleanText = cleanText.replace(/```\s*$/, ""); // Remove closing ```
      cleanText = cleanText.trim();

      // Step 2: Extract JSON object
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      let jsonString = jsonMatch[0];

      // Step 3: Try to parse JSON with multiple strategies
      try {
        article = JSON.parse(jsonString);
      } catch (firstError) {
        // Strategy 2: Try to fix common escape issues
        logger.warn("First parse attempt failed, trying to sanitize JSON...");

        // Remove any invalid escape sequences before special chars
        jsonString = jsonString.replace(/\\([^"\\\/bfnrtu])/g, "$1");

        article = JSON.parse(jsonString);
      }
    } catch (parseError: any) {
      logger.error("Failed to parse Gemini response as JSON:", parseError);
      logger.error("Response text (first 1000 chars):", text.substring(0, 1000));
      logger.error("Response text (last 500 chars):", text.substring(Math.max(0, text.length - 500)));
      throw new Error(`Invalid JSON response from Gemini: ${parseError.message}`);
    }

    // Validate required fields
    if (!article.title || !article.markdown || !article.html) {
      throw new Error("Missing required fields in Gemini response");
    }

    logger.info("[Gemini] ✅ Successfully parsed article:", {
      title: article.title,
      wordCount: article.markdown.split(/\s+/).length,
    });
    logger.info("=".repeat(80));

    return article;
  } catch (error: any) {
    logger.error("=".repeat(80));
    logger.error("[Gemini] ❌ Error processing audio with Gemini:", {
      errorMessage: error.message,
      errorName: error.name,
      errorCode: error.code,
      errorStack: error.stack,
    });
    logger.error("=".repeat(80));
    throw error;
  }
}

export async function testGeminiConnection(): Promise<boolean> {
  try {
    // Initialize genAI if not already done
    if (!genAI) {
      const apiKey = getApiKey();
      genAI = new GoogleGenerativeAI(apiKey);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Hello, test");
    return !!result.response;
  } catch (error) {
    logger.error("Gemini connection test failed:", error);
    return false;
  }
}
