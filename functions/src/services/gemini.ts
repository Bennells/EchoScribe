import { GoogleGenerativeAI } from "@google/generative-ai";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { BLOG_GENERATION_PROMPT } from "../utils/prompts";

// Define API key as secret parameter ONLY in production
// In emulator, we use process.env directly to avoid secret definition issues
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
const geminiApiKeySecret = isEmulator ? null : defineSecret("GEMINI_API_KEY");

function getApiKey(): string {
  // In emulator or local development: use environment variable
  if (isEmulator || process.env.GEMINI_API_KEY) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY not set in environment");
    }
    return key;
  }

  // In production: use Secret Manager
  if (geminiApiKeySecret && geminiApiKeySecret.value()) {
    return geminiApiKeySecret.value();
  }

  throw new Error("GEMINI_API_KEY not configured");
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
    // Initialize genAI if not already done
    if (!genAI) {
      const apiKey = getApiKey();
      genAI = new GoogleGenerativeAI(apiKey);
      logger.info("Initialized Gemini API client");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    logger.info("Sending audio to Gemini API...", {
      audioSize: audioBuffer.length,
      audioSizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
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

    logger.info("Received response from Gemini", {
      responseLength: text.length,
    });

    // Parse JSON response
    let article: BlogArticle;
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      article = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.error("Failed to parse Gemini response as JSON:", parseError);
      logger.error("Response text:", text.substring(0, 500));
      throw new Error("Invalid JSON response from Gemini");
    }

    // Validate required fields
    if (!article.title || !article.markdown || !article.html) {
      throw new Error("Missing required fields in Gemini response");
    }

    logger.info("Successfully parsed article:", {
      title: article.title,
      wordCount: article.markdown.split(/\s+/).length,
    });

    return article;
  } catch (error: any) {
    logger.error("Error processing audio with Gemini:", error);
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

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent("Hello, test");
    return !!result.response;
  } catch (error) {
    logger.error("Gemini connection test failed:", error);
    return false;
  }
}
