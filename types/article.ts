import { Timestamp } from "firebase/firestore";

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
  createdAt: Timestamp;
  editedAt?: Timestamp;
}
