import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./config";
import type { Article } from "@/types/article";

/**
 * Get a single article by ID
 */
export async function getArticle(articleId: string): Promise<Article | null> {
  const articleDoc = await getDoc(doc(db, "articles", articleId));

  if (!articleDoc.exists()) {
    return null;
  }

  return {
    id: articleDoc.id,
    ...articleDoc.data(),
  } as Article;
}

/**
 * Get all articles for a user
 */
export async function getUserArticles(userId: string): Promise<Article[]> {
  const q = query(
    collection(db, "articles"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Article[];
}

/**
 * Delete an article
 */
export async function deleteArticle(articleId: string): Promise<void> {
  await deleteDoc(doc(db, "articles", articleId));
}
