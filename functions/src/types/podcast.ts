/**
 * TypeScript type definitions for podcast processing and blog article generation
 */

export interface SocialMediaContent {
  linkedin: string;
  twitter: string[];
  instagram: string;
  facebook: string;
  tiktok: string;
  newsletter: string;
}

export interface ShowNotesChapter {
  timestamp: string;
  title: string;
  description: string;
}

export interface ShowNotes {
  chapters: ShowNotesChapter[];
  quotes: string[];
  resources: string[];
  guests: string;
}

export interface BlogArticle {
  title: string;
  slug: string;
  metaDescription: string;
  keywords: string[];
  markdown: string;
  html: string;
  schemaOrg: Record<string, any>;
  openGraph: Record<string, string>;
  socialMedia?: SocialMediaContent;
  showNotes?: ShowNotes;
}

/**
 * Audio analysis result from Stage 1 (audio → article only)
 * Contains only the markdown teaser article extracted from audio.
 * Show notes have been removed to simplify generation and prevent truncation.
 */
export interface AudioAnalysisResult {
  markdown: string;
}

/**
 * Metadata result from Stage 2 (article → metadata)
 * Contains SEO metadata and social media content generated from article text
 */
export interface MetadataResult {
  title: string;
  metaDescription: string;
  keywords: string[];
  schemaOrg: Record<string, any>;
  openGraph: Record<string, string>;
  socialMedia: SocialMediaContent;
}

/**
 * @deprecated Use AudioAnalysisResult and MetadataResult instead
 */
export interface BlogArticleCoreResult {
  title: string;
  slug: string;
  metaDescription: string;
  keywords: string[];
  markdown: string;
  html: string;
  schemaOrg: Record<string, any>;
  openGraph: Record<string, string>;
}

/**
 * @deprecated Use AudioAnalysisResult and MetadataResult instead
 */
export interface BlogArticleMetadataResult {
  socialMedia: SocialMediaContent;
  showNotes: ShowNotes;
}
