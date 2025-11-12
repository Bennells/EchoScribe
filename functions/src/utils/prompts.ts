/**
 * AUDIO TO TEASER ARTICLE PROMPT - Stage 1: Generate Complete Article from Podcast Transcript
 */
export const AUDIO_TO_TEASER_ARTICLE_PROMPT = `
Schreibe einen SEO-optimierten Artikel (mind. 600 Wörter, ideal 800–1000 Wörter)
auf Basis des Podcast-Transkripts unten. Verwende Markdown.

**Struktur:**
# Titel
Einleitung (150–200 Wörter)
## Hauptthema 1 (150–200 Wörter)
## Hauptthema 2 (150–200 Wörter)
## Hauptthema 3 (150–200 Wörter)
## Fazit (100–150 Wörter, mit Call-to-Action)

**Stilrichtlinien:**
- Professionell, aber leserfreundlich.
- Neugierig machend, ohne alles zu verraten.
- Verwende Phrasen wie „Mehr dazu im Podcast…“.
- Keine Ein-Satz-Absätze.

**Ausgabe:**
JSON-Objekt:
{
  "markdown": "<Artikeltext in Markdown>",
  "title": "<SEO-Titel, max 60 Zeichen>",
  "metaDescription": "<Meta-Description, 100–160 Zeichen>",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
}

**Podcast-Transkript:**
{{transcript}}
`;


/**
 * METADATA GENERATION PROMPT - Stage 2: Generate Complete SEO & Social Media Metadata
 */
export const METADATA_GENERATION_PROMPT = `
Erstelle SEO- und Social-Media-Metadaten auf Basis des Artikels.

**Ausgabeformat (genau ein JSON-Objekt):**
{
  "schemaOrg": {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "... (max 110 Zeichen)",
    "description": "... (max 200 Zeichen)",
    "author": "EchoScribe",
    "publisher": "EchoScribe",
    "datePublished": "YYYY-MM-DD",
    "image": "https://example.com/image.jpg"
  },
  "openGraph": {
    "og:title": "... (max 60 Zeichen)",
    "og:description": "... (max 155 Zeichen)",
    "og:image": "https://example.com/og.jpg",
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:site_name": "EchoScribe"
  },
  "socialMedia": {
    "linkedin": "<max 300 Zeichen>",
    "twitter": ["t1", "t2", "t3", "t4"],
    "instagram": "<max 150 Wörter>",
    "facebook": "<max 250 Wörter>",
    "tiktok": "<max 80 Wörter>",
    "newsletter": "<max 100 Wörter>"
  }
}

**Regeln:**
- Prägnant, keine Wiederholungen.
- Überschreite keine Längenlimits.
- Nach dem Newsletter sofort stoppen.
`;
