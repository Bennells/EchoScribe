import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytesResumable, deleteObject, UploadTask } from "firebase/storage";
import { db, storage } from "./config";
import type { Podcast } from "@/types/podcast";

export async function createPodcast(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ uploadTask: UploadTask; storagePath: string }> {
  // Generate storage path
  const storagePath = `podcasts/${userId}/${Date.now()}_${file.name}`;

  // Upload directly to Storage (no Firestore document yet)
  // The Cloud Function will create the Firestore document when upload completes
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  // Monitor upload progress
  uploadTask.on(
    "state_changed",
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      if (onProgress) {
        onProgress(progress);
      }
    },
    (error) => {
      console.error("Upload error:", error);
      // Error will be handled by the caller
    },
    () => {
      // Upload complete - Cloud Function will handle the rest
      console.log("Upload complete, waiting for Cloud Function processing...");
    }
  );

  return {
    uploadTask,
    storagePath,
  };
}

export async function getUserPodcasts(userId: string): Promise<Podcast[]> {
  const q = query(
    collection(db, "podcasts"),
    where("userId", "==", userId),
    orderBy("uploadedAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Podcast[];
}

/**
 * Subscribe to real-time updates for user's podcasts
 * Returns an unsubscribe function to clean up the listener
 */
export function subscribeToUserPodcasts(
  userId: string,
  onUpdate: (podcasts: Podcast[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "podcasts"),
    where("userId", "==", userId),
    orderBy("uploadedAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const podcasts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Podcast[];
    onUpdate(podcasts);
  });
}

export async function deletePodcast(podcastId: string, storagePath: string): Promise<void> {
  // Delete from Storage
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting file from storage:", error);
  }

  // Delete from Firestore
  await deleteDoc(doc(db, "podcasts", podcastId));
}

export async function getPodcastStats(userId: string) {
  const q = query(collection(db, "podcasts"), where("userId", "==", userId));

  const snapshot = await getDocs(q);

  const total = snapshot.size;
  const completed = snapshot.docs.filter((doc) => doc.data().status === "completed").length;
  const processing = snapshot.docs.filter(
    (doc) => doc.data().status === "processing" || doc.data().status === "queued"
  ).length;
  const errors = snapshot.docs.filter((doc) => doc.data().status === "error").length;

  // Count this month's uploads
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonth = snapshot.docs.filter((doc) => {
    const uploadedAt = doc.data().uploadedAt?.toDate();
    return uploadedAt && uploadedAt >= firstOfMonth;
  }).length;

  return {
    total,
    completed,
    processing,
    errors,
    thisMonth,
  };
}
