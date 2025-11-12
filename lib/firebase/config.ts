import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Firebase Client SDK configuration is automatically provided by App Hosting
// via the FIREBASE_WEBAPP_CONFIG environment variable during build time.
// The Firebase SDK automatically detects and uses this configuration.
// No manual firebaseConfig object is needed.

// Initialize Firebase only in browser context
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

// Only initialize Firebase in the browser
if (typeof window !== "undefined") {
  // initializeApp() with no arguments automatically uses FIREBASE_WEBAPP_CONFIG
  app = getApps().length === 0 ? initializeApp() : getApps()[0];
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);
}

// Export instances - these will be undefined during SSR/SSG
export const auth = authInstance!;
export const db = dbInstance!;
export const storage = storageInstance!;
