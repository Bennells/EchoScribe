import { Timestamp } from "firebase/firestore";

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

export interface Article {
  id: string;
  podcastId: string;
  userId: string;
  title: string;
  slug: string;
  metaDescription: string;
  keywords: string[];
  contentMarkdown: string;
  contentHTML: string;
  schemaOrgMarkup: Record<string, any>;
  openGraphTags: {
    "og:title": string;
    "og:description": string;
    "og:type": string;
    "og:url"?: string;
    "og:image"?: string;
  };
  socialMedia?: SocialMediaContent;
  showNotes?: ShowNotes;
  createdAt: Timestamp;
  editedAt?: Timestamp;
}
