"use server";

import { adminDb, adminAuth, adminStorage } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import type { User } from "@/types/user";
import type { Podcast } from "@/types/podcast";
import type { Article } from "@/types/article";
import type { Subscription } from "@/types/subscription";

export interface UserDataExport {
  user: User | null;
  podcasts: Array<Podcast & { downloadUrl?: string }>;
  articles: Article[];
  subscriptions: Subscription[];
}

/**
 * Server action to fetch all user data for GDPR data access (Art. 15)
 * Requires authentication via httpOnly cookie
 */
export async function getUserData(): Promise<{
  success: boolean;
  data?: UserDataExport;
  error?: string;
}> {
  try {
    // Get Firebase token from cookie
    const cookieStore = await cookies();
    const firebaseToken = cookieStore.get("firebase-token")?.value;

    if (!firebaseToken) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify token and get user ID
    const decodedToken = await adminAuth.verifyIdToken(firebaseToken);
    const userId = decodedToken.uid;

    // Fetch user document
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.exists
      ? ({ id: userDoc.id, ...userDoc.data() } as User)
      : null;

    // Fetch podcasts
    const podcastsSnapshot = await adminDb
      .collection("podcasts")
      .where("userId", "==", userId)
      .orderBy("uploadedAt", "desc")
      .get();

    const podcasts = podcastsSnapshot.docs.map((doc) => {
      const podcastData = { id: doc.id, ...doc.data() } as Podcast;

      // Generate Firebase Storage download URL
      // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
      let downloadUrl: string | undefined;
      if (podcastData.storagePath) {
        try {
          const bucket = adminStorage.bucket();
          const encodedPath = encodeURIComponent(podcastData.storagePath);
          downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;
        } catch (error) {
          console.error("Error generating download URL:", error);
        }
      }

      return {
        ...podcastData,
        downloadUrl,
      };
    });

    // Fetch articles
    const articlesSnapshot = await adminDb
      .collection("articles")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const articles = articlesSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Article)
    );

    // Fetch subscriptions
    const subscriptionsSnapshot = await adminDb
      .collection("subscriptions")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const subscriptions = subscriptionsSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Subscription)
    );

    return {
      success: true,
      data: {
        user: userData,
        podcasts,
        articles,
        subscriptions,
      },
    };
  } catch (error: any) {
    console.error("Error fetching user data:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch user data",
    };
  }
}
