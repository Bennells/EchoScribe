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
 * Core article result from first processing stage (audio → article)
 * Contains essential article content and basic SEO metadata
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
 * Metadata result from second processing stage (article → metadata)
 * Contains social media content and show notes generated from article
 */
export interface BlogArticleMetadataResult {
  socialMedia: SocialMediaContent;
  showNotes: ShowNotes;
}
