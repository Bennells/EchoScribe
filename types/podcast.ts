import { Timestamp } from "firebase/firestore";

export type PodcastStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "completed"
  | "error"
  | "quota_exceeded";

export interface Podcast {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  status: PodcastStatus;
  uploadedAt: Timestamp;
  queuedAt?: Timestamp;
  processingStartedAt?: Timestamp;
  processingCompletedAt?: Timestamp;
  errorMessage?: string;
  errorAt?: Timestamp;
  articleId?: string;
  duration?: number; // Server-verified duration (source of truth for billing)
  clientReportedDuration?: number; // What client reported (for comparison)
  durationVerified?: boolean; // Whether server has validated duration
}
