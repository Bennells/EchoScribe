import * as admin from "firebase-admin";

// Set Firestore emulator host BEFORE any Firebase Admin initialization
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  console.log("🔧 Firestore Admin SDK configured to use emulator at localhost:8080");
}

// Initialize Firebase Admin SDK for Next.js API routes
// Uses Workload Identity Federation when running on Firebase App Hosting or Cloud Functions
// Uses basic initialization for local development with emulators

function createFirebaseAdminApp() {
  // Check if already initialized
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string;

  // DEV mode with emulators - basic initialization without credentials
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
    console.log("🔧 Initializing Firebase Admin SDK for emulator environment");
    return admin.initializeApp({
      projectId: projectId,
    });
  }

  // TEST/PROD mode with Workload Identity Federation (Firebase App Hosting / Cloud Functions)
  // Uses Application Default Credentials (ADC) - no service account keys needed
  console.log("🔧 Initializing Firebase Admin SDK with Application Default Credentials (Workload Identity)");
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export const adminApp = createFirebaseAdminApp();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
