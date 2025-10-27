# EchoScribe Project Context

## Environment Setup

### Current Environments
1. **Local Development** (`npm run dev`)
   - Uses `.env.local` for configuration
   - Next.js runs locally on development server
   - **Uses the SAME Firebase Backend as Test**

2. **Test/Staging** (Firebase App Hosting)
   - Deployed via Firebase App Hosting
   - Configuration in `apphosting.yaml`
   - **Shares Firebase Backend with Local**

3. **Production** (Not yet in use)
   - Firebase Project: `echoscribe-prod`
   - Not currently active

### Firebase Backend Configuration

**Active Backend:** `echoscribe-test` (used by both Local and Test environments)

```
Firebase Project: echoscribe-test
- Firestore Database
- Firebase Storage
- Firebase Authentication
- Cloud Functions (deployed)
- App Hosting (for Test/Staging web app)
```

**Project Aliases:**
- `default`: `demo-echoscribe` (demo/playground)
- `test`: `echoscribe-test` (active development)
- `prod`: `echoscribe-prod` (not yet used)

### Important Notes

1. **NO EMULATOR USAGE:**
   - The app should NOT use Firebase Emulators
   - All emulator-related code should be removed
   - Both local and test environments connect to the real Firebase backend

2. **Shared Backend:**
   - Local development (`npm run dev`) connects to `echoscribe-test`
   - Test/Staging (App Hosting) connects to `echoscribe-test`
   - Same data, same functions, same storage

3. **Cloud Functions:**
   - Deployed to `echoscribe-test`
   - Region: `europe-west1`
   - Service Account: `436441931185-compute@developer.gserviceaccount.com`

### Configuration Files

- **Local:** `.env.local` (Next.js environment variables)
- **Test/Staging:** `apphosting.yaml` (App Hosting configuration)
- **Firebase:** `.firebaserc` (project aliases)
- **Functions:** `functions/src/` (deployed to echoscribe-test)

## Development Workflow

1. **Local Development:**
   ```bash
   npm run dev
   # Connects to echoscribe-test backend
   ```

2. **Deploy Functions:**
   ```bash
   firebase use test
   firebase deploy --only functions
   ```

3. **Deploy App to App Hosting:**
   - Push to GitHub
   - Automatic deployment via App Hosting
   - Or manual: `firebase apphosting:rollouts:create`

## Critical Dependencies

- **firebase-admin SDK:** MUST NOT be removed (required for server-side operations)
  - Stripe Webhook handler
  - Token verification with Workload Identity
  - Server Actions in production

## Current Issues & Solutions

### Issue: GEMINI_API_KEY not accessible by Cloud Functions
- **Cause:** Secret Manager permissions not set for Cloud Functions service account
- **Solution:** Grant Secret Manager access to service account

### Issue: Emulator references in code
- **Cause:** Legacy emulator code still present
- **Solution:** Remove all emulator-related code and checks
