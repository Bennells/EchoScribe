import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK for Next.js API routes
// Uses Application Default Credentials (ADC):
// - On localhost: gcloud auth application-default credentials
// - On Firebase App Hosting/Cloud Functions: Workload Identity Federation

function createFirebaseAdminApp() {
  // Check if already initialized
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Uses Application Default Credentials (ADC)
  // This works automatically in all environments:
  // - Localhost: Requires `gcloud auth application-default login`
  // - Firebase App Hosting: Uses Workload Identity (automatic)
  // - Cloud Functions: Uses Workload Identity (automatic)

  // Explicitly set project ID to ensure correct Firebase project is used
  // This is especially important when switching between projects
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: projectId,
  });
}

export const adminApp = createFirebaseAdminApp();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
export const adminStorage = admin.storage(adminApp);
