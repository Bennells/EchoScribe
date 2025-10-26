import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";

// Parse Firebase config from environment at build time
// This creates compile-time constants that are embedded in the client bundle
// Priority:
// 1. FIREBASE_WEBAPP_CONFIG (Firebase App Hosting auto-provided)
// 2. FIREBASE_CLIENT_CONFIG (Secret Manager - our custom secret)
// 3. Individual NEXT_PUBLIC_* vars (local development)

function getFirebaseConfig() {
  // Try Firebase App Hosting's auto-provided config first
  if (process.env.FIREBASE_WEBAPP_CONFIG) {
    try {
      return JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
    } catch (error) {
      console.error("Failed to parse FIREBASE_WEBAPP_CONFIG:", error);
    }
  }

  // Try our custom secret
  if (process.env.FIREBASE_CLIENT_CONFIG) {
    try {
      return JSON.parse(process.env.FIREBASE_CLIENT_CONFIG);
    } catch (error) {
      console.error("Failed to parse FIREBASE_CLIENT_CONFIG:", error);
    }
  }

  // Fallback to individual environment variables (local development)
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

// Parse config at build time - this becomes a compile-time constant
const firebaseConfig = getFirebaseConfig();

// Initialize Firebase only in browser context
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

// Only initialize Firebase in the browser
if (typeof window !== "undefined") {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  // Initialize services
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);

  // Connect to emulators in development
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
    connectAuthEmulator(authInstance, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(dbInstance, "localhost", 8080);
    connectStorageEmulator(storageInstance, "localhost", 9199);
  }
}

// Export instances - these will be undefined during SSR/SSG
export const auth = authInstance!;
export const db = dbInstance!;
export const storage = storageInstance!;
