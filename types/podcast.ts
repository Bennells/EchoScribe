import { Timestamp } from "firebase/firestore";

export type PodcastStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "completed"
  | "error";

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
  duration?: number;
}
