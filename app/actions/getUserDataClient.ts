"use client";

import { collection, doc, getDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
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
 * Client-side function to fetch all user data for GDPR data access (Art. 15)
 * Uses Firebase Client SDK with user's authentication
 */
export async function getUserDataClient(userId: string): Promise<{
  success: boolean;
  data?: UserDataExport;
  error?: string;
}> {
  try {
    // Fetch user document
    const userDoc = await getDoc(doc(db, "users", userId));
    const userData = userDoc.exists()
      ? ({ id: userDoc.id, ...userDoc.data() } as User)
      : null;

    // Fetch podcasts
    const podcastsQuery = query(
      collection(db, "podcasts"),
      where("userId", "==", userId),
      orderBy("uploadedAt", "desc")
    );
    const podcastsSnapshot = await getDocs(podcastsQuery);

    const podcasts = podcastsSnapshot.docs.map((doc) => {
      const podcastData = { id: doc.id, ...doc.data() } as Podcast;

      // Generate Firebase Storage download URL
      let downloadUrl: string | undefined;
      if (podcastData.storagePath) {
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        const encodedPath = encodeURIComponent(podcastData.storagePath);
        downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
      }

      return {
        ...podcastData,
        downloadUrl,
      };
    });

    // Fetch articles
    const articlesQuery = query(
      collection(db, "articles"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const articlesSnapshot = await getDocs(articlesQuery);
    const articles = articlesSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Article)
    );

    // Fetch subscriptions
    const subscriptionsQuery = query(
      collection(db, "subscriptions"),
      where("userId", "==", userId),
      orderBy("currentPeriodStart", "desc")
    );
    const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
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
