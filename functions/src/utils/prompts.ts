/**
 * AUDIO TO TEASER ARTICLE PROMPT - Stage 1: Generate Complete Article from Podcast Transcript
 *
 * NOTE: This prompt is used as a base template. The actual language is determined by
 * the detected transcript language in article.ts
 */
export const AUDIO_TO_TEASER_ARTICLE_PROMPT_EN = `
Write an SEO-optimized article (minimum 600 words, ideally 800–1000 words)
based on the podcast transcript below. Use Markdown.

IMPORTANT: Write the article in the SAME LANGUAGE as the podcast transcript.

**Structure:**
# Title
Introduction (150–200 words)
## Main Topic 1 (150–200 words)
## Main Topic 2 (150–200 words)
## Main Topic 3 (150–200 words)
## Conclusion (100–150 words, with Call-to-Action)

**Style Guidelines:**
- Professional yet reader-friendly.
- Intriguing without revealing everything.
- Use phrases like "Learn more in the podcast…".
- No single-sentence paragraphs.

**Output:**
JSON object:
{
  "markdown": "<Article text in Markdown>",
  "title": "<SEO title, max 60 characters>",
  "metaDescription": "<Meta description, 100–160 characters>",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
}

**Podcast Transcript:**
{{transcript}}
`;

export const AUDIO_TO_TEASER_ARTICLE_PROMPT_DE = `
Schreibe einen SEO-optimierten Artikel (mindestens 600 Wörter, idealerweise 800–1000 Wörter)
basierend auf dem unten stehenden Podcast-Transkript. Verwende Markdown.

WICHTIG: Schreibe den Artikel in der GLEICHEN SPRACHE wie das Podcast-Transkript.

**Struktur:**
# Titel
Einleitung (150–200 Wörter)
## Hauptthema 1 (150–200 Wörter)
## Hauptthema 2 (150–200 Wörter)
## Hauptthema 3 (150–200 Wörter)
## Fazit (100–150 Wörter, mit Call-to-Action)

**Stil-Richtlinien:**
- Professionell aber leserfreundlich.
- Spannend, ohne alles zu verraten.
- Verwende Formulierungen wie „Erfahre mehr im Podcast…".
- Keine Ein-Satz-Absätze.

**Output:**
JSON-Objekt:
{
  "markdown": "<Artikeltext in Markdown>",
  "title": "<SEO-Titel, max 60 Zeichen>",
  "metaDescription": "<Meta-Beschreibung, 100–160 Zeichen>",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
}

**Podcast-Transkript:**
{{transcript}}
`;

// Default export for backwards compatibility
export const AUDIO_TO_TEASER_ARTICLE_PROMPT = AUDIO_TO_TEASER_ARTICLE_PROMPT_EN;


/**
 * METADATA GENERATION PROMPT - Stage 2: Generate Complete SEO & Social Media Metadata
 */
export const METADATA_GENERATION_PROMPT = `
Create SEO and social media metadata based on the article.

**Output Format (exactly one JSON object):**
{
  "schemaOrg": {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "... (max 110 characters)",
    "description": "... (max 200 characters)",
    "author": "EchoScribe",
    "publisher": "EchoScribe",
    "datePublished": "YYYY-MM-DD",
    "image": "https://example.com/image.jpg"
  },
  "openGraph": {
    "og:title": "... (max 60 characters)",
    "og:description": "... (max 155 characters)",
    "og:image": "https://example.com/og.jpg",
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:site_name": "EchoScribe"
  },
  "socialMedia": {
    "linkedin": "<max 300 characters>",
    "twitter": ["t1", "t2", "t3", "t4"],
    "instagram": "<max 150 words>",
    "facebook": "<max 250 words>",
    "tiktok": "<max 80 words>",
    "newsletter": "<max 100 words>"
  }
}

**Rules:**
- Concise, no repetitions.
- Do not exceed length limits.
- Stop immediately after newsletter.
`;
