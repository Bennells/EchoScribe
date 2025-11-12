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

  // Project ID is automatically detected by ADC in App Hosting via WIF
  // In development, GCLOUD_PROJECT is set by gcloud CLI
  // In App Hosting, ADC automatically uses the correct project
  const projectId = process.env.GCLOUD_PROJECT;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: projectId,
    storageBucket: storageBucket,
  });
}

export const adminApp = createFirebaseAdminApp();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
export const adminStorage = admin.storage(adminApp);
