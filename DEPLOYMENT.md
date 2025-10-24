# EchoScribe - Deployment Guide

This guide covers deploying EchoScribe to DEV, TEST, and PROD environments.

## Environment Overview

| Environment | Firebase Project | Use Case | Cloud Tasks |
|-------------|------------------|----------|-------------|
| **DEV** | `demo-echoscribe` | Local development with emulators | ❌ No (direct processing) |
| **TEST** | `echoscribe-test` | Staging/testing before production | ✅ Yes |
| **PROD** | `echoscribe-prod` | Production with real users | ✅ Yes |

## Prerequisites

- Node.js 20+ installed
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase projects created:
  - `echoscribe-test` (for TEST environment)
  - `echoscribe-prod` (for PROD environment)
- Gemini API key from Google AI Studio
- Stripe account (Test and Live mode keys)

## Initial Setup

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd EchoScribe
npm install
cd functions
npm install
cd ..
```

### 2. Configure Environment Files

#### DEV Environment (.env.local)

Already configured for local development with emulators. Uses `demo-echoscribe` project.

#### TEST Environment (.env.test)

1. Copy `.env.test` and fill in your TEST project values:
   ```bash
   # Get these from Firebase Console > Project Settings
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=echoscribe-test
   # ... etc
   ```

2. Get Stripe TEST keys from [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)

3. Download Firebase Admin service account:
   - Firebase Console > Project Settings > Service Accounts
   - Generate new private key
   - Add credentials to `.env.test`

#### PROD Environment (.env.production)

Same process as TEST, but use:
- PROD Firebase project values
- Stripe LIVE mode keys (handle with care!)
- PROD service account credentials

**⚠️ IMPORTANT: Never commit `.env.test` or `.env.production` with real values to git!**

### 3. Configure Firebase Secrets

For TEST and PROD, configure the Gemini API key as a Firebase Secret (more secure than env files):

```bash
# TEST environment
npm run secrets:set:test
# Enter your Gemini API key when prompted

# PROD environment
npm run secrets:set:prod
# Enter your Gemini API key when prompted
```

## Development Workflow

### Local Development (DEV)

```bash
# Terminal 1: Start Firebase emulators
npm run emulators

# Terminal 2: Start Next.js dev server
npm run dev
```

Access:
- App: http://localhost:3000
- Emulator UI: http://localhost:4000

**How it works:**
- Uses `.env.local` configuration
- Connects to Firebase emulators (Auth, Firestore, Storage, Functions)
- Podcast processing uses **direct processing** (no Cloud Tasks - emulator limitation)
- No real costs or API quotas consumed

### Testing in TEST Environment

1. **Switch to TEST project:**
   ```bash
   npm run firebase:use:test
   ```

2. **Deploy to TEST:**
   ```bash
   npm run deploy:test
   ```
   Or just functions:
   ```bash
   npm run deploy:functions:test
   ```

3. **Run your Next.js app pointing to TEST:**
   ```bash
   # Use .env.test configuration
   # Configure your hosting (Vercel/Cloud Run) to use TEST environment variables
   ```

**How it works:**
- Uses real Firebase project `echoscribe-test`
- Podcast processing uses **Cloud Tasks** (same as production!)
- Tests the EXACT same code path as production
- Uses Stripe TEST mode
- Safe to test without affecting real users

### Production Deployment

1. **Switch to PROD project:**
   ```bash
   npm run firebase:use:prod
   ```

2. **Deploy to PROD:**
   ```bash
   npm run deploy:prod
   ```
   Or just functions:
   ```bash
   npm run deploy:functions:prod
   ```

3. **Deploy Next.js app:**
   ```bash
   # Configure your hosting platform with PROD environment variables
   # Example for Vercel: vercel --prod
   ```

**How it works:**
- Uses real Firebase project `echoscribe-prod`
- Podcast processing uses **Cloud Tasks** (robust, scalable)
- Uses Stripe LIVE mode (real payments!)
- Serves real users

## Cloud Functions Architecture

### DEV (Emulator)
```
Upload → Storage Trigger → Direct Processing → Article Created
```

### TEST & PROD
```
Upload → Storage Trigger → Cloud Task Queue → Task Processes Podcast → Article Created
                          ↓
                    Returns immediately
```

**Benefits of Cloud Tasks (TEST/PROD):**
- ✅ No timeout limits (up to 60 minutes vs 9 minutes for functions)
- ✅ Automatic retries with exponential backoff
- ✅ Rate limiting (max 3 concurrent processing)
- ✅ Better error handling and monitoring
- ✅ Scalable queue management

## Deployment Commands Reference

| Command | Description |
|---------|-------------|
| `npm run firebase:use:dev` | Switch to DEV (emulator) |
| `npm run firebase:use:test` | Switch to TEST environment |
| `npm run firebase:use:prod` | Switch to PROD environment |
| `npm run deploy:test` | Deploy everything to TEST |
| `npm run deploy:prod` | Deploy everything to PROD |
| `npm run deploy:functions:test` | Deploy only Cloud Functions to TEST |
| `npm run deploy:functions:prod` | Deploy only Cloud Functions to PROD |
| `npm run secrets:set:test` | Set GEMINI_API_KEY secret for TEST |
| `npm run secrets:set:prod` | Set GEMINI_API_KEY secret for PROD |

## Verifying Deployment

### Check Cloud Functions

```bash
# List deployed functions
firebase functions:list

# Check function logs
firebase functions:log
```

### Check Secrets

```bash
# View configured secrets
firebase functions:secrets:access GEMINI_API_KEY
```

### Test Upload

1. Go to your deployed app
2. Upload a test podcast
3. Check Firebase Console > Firestore > podcasts collection
4. Status should progress: `queued` → `processing` → `completed`
5. Check Cloud Tasks queue in Firebase Console

## Troubleshooting

### Cloud Tasks not working

**Symptom:** Podcasts stuck in "queued" status

**Solution:**
1. Verify Cloud Tasks API is enabled in Google Cloud Console
2. Check function logs: `firebase functions:log`
3. Verify region matches: `europe-west1` (configured in functions)

### Gemini API errors

**Symptom:** Processing fails with API key errors

**Solution:**
1. Verify secret is set: `firebase functions:secrets:access GEMINI_API_KEY`
2. Re-set if needed: `npm run secrets:set:test` or `npm run secrets:set:prod`
3. Check Gemini API quota in Google AI Studio

### Authentication issues

**Symptom:** Users can't log in

**Solution:**
1. Verify environment variables in your hosting platform
2. Check Firebase Console > Authentication > Sign-in method
3. Verify authorized domains in Firebase Console

## Environment Variables Checklist

Before deploying to TEST or PROD, ensure you have configured:

- [ ] Firebase project credentials (API key, project ID, etc.)
- [ ] Firebase Admin service account credentials
- [ ] Gemini API key (via Firebase Secrets)
- [ ] Stripe keys (Test for TEST, Live for PROD)
- [ ] Stripe webhook secret
- [ ] Stripe price IDs

## Security Best Practices

1. **Never commit** `.env.test` or `.env.production` with real values
2. **Use Firebase Secrets** for sensitive data in Cloud Functions
3. **Use environment variables** in your hosting platform (Vercel, Cloud Run, etc.)
4. **Rotate keys regularly**, especially after team member changes
5. **Enable Firebase App Check** for production (protects against abuse)
6. **Monitor usage** in Firebase Console and Stripe Dashboard

## Monitoring

### Firebase Console

- Cloud Functions logs and metrics
- Firestore data and usage
- Storage usage
- Authentication users

### Stripe Dashboard

- Payments and subscriptions
- Failed payments
- Customer management

### Google Cloud Console

- Cloud Tasks queue status
- Detailed function logs
- Resource usage and billing

## Rollback Strategy

If production deployment has issues:

1. **Rollback Cloud Functions:**
   ```bash
   # List previous deployments
   firebase functions:list

   # Rollback is not directly supported, redeploy previous version
   # Best practice: Keep your git history clean and redeploy from previous commit
   ```

2. **Monitor error rates** in Cloud Console

3. **Communicate with users** about any issues

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions, GitLab CI, etc.)
2. Implement automated testing before deployment
3. Configure monitoring and alerts (Firebase Performance, Cloud Monitoring)
4. Set up backup strategy for Firestore data
5. Enable Firebase App Check for production security

## Support

For issues or questions:
- Check Firebase documentation: https://firebase.google.com/docs
- Review Cloud Functions logs: `firebase functions:log`
- Contact your team lead or DevOps
