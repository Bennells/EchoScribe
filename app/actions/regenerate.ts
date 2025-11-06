"use server";

import { adminAuth as auth, adminDb as db } from "@/lib/firebase/admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export type RegenerateField = "title" | "metaDescription" | "keywords" | "slug";

interface RegenerateResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function regenerateArticleField(
  articleId: string,
  field: RegenerateField,
  idToken: string
): Promise<RegenerateResult> {
  try {
    // Verify authentication
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get article
    const articleDoc = await db.collection("articles").doc(articleId).get();
    if (!articleDoc.exists) {
      return { success: false, error: "Artikel nicht gefunden" };
    }

    const articleData = articleDoc.data();
    if (articleData?.userId !== userId) {
      return { success: false, error: "Keine Berechtigung" };
    }

    // Generate new content based on field
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    let prompt = "";
    let newValue: any;

    switch (field) {
      case "title":
        prompt = `Based on this blog article content, generate a NEW SEO-optimized German title (different from the current one).

Current title: ${articleData.title}

Article content (first 500 chars):
${articleData.contentMarkdown.substring(0, 500)}

Requirements:
- Must be in German
- Maximum 60 characters
- SEO-optimized
- Catchy and engaging
- Different from the current title

Return ONLY the new title text, nothing else.`;

        const titleResult = await model.generateContent(prompt);
        newValue = titleResult.response.text().trim().replace(/^["']|["']$/g, "");

        // Ensure it's not too long
        if (newValue.length > 60) {
          newValue = newValue.substring(0, 57) + "...";
        }

        await articleDoc.ref.update({ title: newValue });
        break;

      case "metaDescription":
        prompt = `Based on this blog article, generate a NEW SEO-optimized German meta description (different from the current one).

Current meta description: ${articleData.metaDescription}

Article content (first 500 chars):
${articleData.contentMarkdown.substring(0, 500)}

Requirements:
- Must be in German
- Maximum 160 characters
- Include a call-to-action (CTA)
- SEO-optimized
- Engaging and informative
- Different from the current meta description

Return ONLY the new meta description text, nothing else.`;

        const metaResult = await model.generateContent(prompt);
        newValue = metaResult.response.text().trim().replace(/^["']|["']$/g, "");

        // Ensure it's not too long
        if (newValue.length > 160) {
          newValue = newValue.substring(0, 157) + "...";
        }

        await articleDoc.ref.update({ metaDescription: newValue });
        break;

      case "keywords":
        prompt = `Based on this blog article, generate NEW SEO keywords (different from the current ones).

Current keywords: ${articleData.keywords.join(", ")}

Article title: ${articleData.title}

Article content (first 500 chars):
${articleData.contentMarkdown.substring(0, 500)}

Requirements:
- Must be in German
- 5-8 relevant keywords or short phrases
- SEO-optimized
- Mix of broad and specific terms
- Different from the current keywords

Return ONLY a comma-separated list of keywords, nothing else.`;

        const keywordsResult = await model.generateContent(prompt);
        const keywordsText = keywordsResult.response.text().trim();
        newValue = keywordsText
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
          .slice(0, 8);

        await articleDoc.ref.update({ keywords: newValue });
        break;

      case "slug":
        prompt = `Based on this blog article title, generate a NEW URL-friendly slug (different from the current one).

Current slug: ${articleData.slug}
Title: ${articleData.title}

Requirements:
- Must be in German but URL-safe
- Convert umlauts (ä→ae, ö→oe, ü→ue, ß→ss)
- Lowercase
- Hyphens instead of spaces
- No special characters
- Maximum 60 characters
- SEO-optimized
- Different from the current slug

Return ONLY the new slug, nothing else.`;

        const slugResult = await model.generateContent(prompt);
        newValue = slugResult.response
          .text()
          .trim()
          .toLowerCase()
          .replace(/ä/g, "ae")
          .replace(/ö/g, "oe")
          .replace(/ü/g, "ue")
          .replace(/ß/g, "ss")
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .substring(0, 60);

        await articleDoc.ref.update({ slug: newValue });
        break;

      default:
        return { success: false, error: "Ungültiges Feld" };
    }

    return { success: true, data: newValue };
  } catch (error) {
    console.error("Error regenerating field:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unbekannter Fehler",
    };
  }
}
