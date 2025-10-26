import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";

// Parse Firebase config from environment
// Priority: FIREBASE_CLIENT_CONFIG (production) > individual NEXT_PUBLIC_* vars (local dev)
let firebaseConfig;

if (process.env.FIREBASE_CLIENT_CONFIG) {
  // Production/Test: Parse JSON config from Secret Manager
  try {
    firebaseConfig = JSON.parse(process.env.FIREBASE_CLIENT_CONFIG);
  } catch (error) {
    console.error("Failed to parse FIREBASE_CLIENT_CONFIG:", error);
    throw new Error("Invalid Firebase configuration in FIREBASE_CLIENT_CONFIG");
  }
} else {
  // Local development: Use individual environment variables
  firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

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
