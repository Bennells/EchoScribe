import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "./config";

// Helper functions for Firestore operations
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
};

// Re-export db for convenience
export { db };
