/**
 * TypeScript type definitions for podcast processing and blog article generation
 */

/**
 * Token usage information from OpenAI API
 * Used for cost tracking and analytics
 */
export interface TokenUsageInfo {
  /** Number of input/prompt tokens used */
  inputTokens: number;

  /** Number of output/completion tokens generated */
  outputTokens: number;

  /** Total tokens used (input + output) */
  totalTokens: number;

  /** Estimated cost in USD */
  costUSD: number;

  /** Estimated cost in EUR */
  costEUR: number;
}

/**
 * Complete token usage tracking for two-stage processing pipeline
 */
export interface PodcastTokenUsage {
  /** Stage 1: Audio → Article generation */
  stage1: TokenUsageInfo & {
    /** Audio input cost (separate from text tokens) */
    audioCostUSD: number;
    audioCostEUR: number;
  };

  /** Stage 2: Article → Metadata generation */
  stage2: TokenUsageInfo;

  /** Combined totals across both stages */
  total: {
    totalTokens: number;
    totalCostUSD: number;
    totalCostEUR: number;
  };

  /** Timestamp when costs were calculated */
  calculatedAt: Date;
}

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

/**
 * Complete metadata including Schema.org, Open Graph, and social media content
 */
export interface PodcastMetadata {
  schemaOrg: Record<string, any>;
  openGraph: Record<string, string>;
  socialMedia: SocialMediaContent;
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
  tokenUsage?: PodcastTokenUsage;
}

