import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK for Next.js API routes
// This is separate from the Cloud Functions admin instance

interface FirebaseAdminAppParams {
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
}

function formatPrivateKey(key: string) {
  return key.replace(/\\n/g, "\n");
}

function createFirebaseAdminApp(params: FirebaseAdminAppParams) {
  const projectId = params.projectId;
  const clientEmail = params.clientEmail;
  const privateKey = params.privateKey;

  // Check if already initialized
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // DEV mode with emulators
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
    return admin.initializeApp({
      projectId: projectId,
    });
  }

  // TEST/PROD mode with credentials
  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY environment variables."
    );
  }

  const formattedPrivateKey = formatPrivateKey(privateKey);

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: formattedPrivateKey,
    }),
  });
}

function initAdmin() {
  const params: FirebaseAdminAppParams = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  };

  return createFirebaseAdminApp(params);
}

export const adminApp = initAdmin();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
