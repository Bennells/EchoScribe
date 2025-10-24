# EchoScribe - Environment Configuration Quick Reference

## Environment Overview

### DEV (Local Development)
- **Firebase Project:** `demo-echoscribe` (emulator)
- **Config File:** `.env.local`
- **Processing:** Direct (no Cloud Tasks - emulator limitation)
- **Start:** `npm run emulators` + `npm run dev`
- **Use Case:** Local development, fast iteration, no costs

### TEST (Staging)
- **Firebase Project:** `echoscribe-test`
- **Config File:** `.env.test`
- **Processing:** Cloud Tasks ✅
- **Deploy:** `npm run deploy:test`
- **Use Case:** Integration testing, pre-production validation

### PROD (Production)
- **Firebase Project:** `echoscribe-prod`
- **Config File:** `.env.production`
- **Processing:** Cloud Tasks ✅
- **Deploy:** `npm run deploy:prod`
- **Use Case:** Real users, production workloads

## Quick Commands

### Switch Environments
```bash
npm run firebase:use:dev   # Switch to DEV (emulator)
npm run firebase:use:test  # Switch to TEST
npm run firebase:use:prod  # Switch to PROD
```

### Deploy
```bash
npm run deploy:test              # Deploy all to TEST
npm run deploy:prod              # Deploy all to PROD
npm run deploy:functions:test    # Deploy only functions to TEST
npm run deploy:functions:prod    # Deploy only functions to PROD
```

### Configure Secrets
```bash
npm run secrets:set:test   # Set GEMINI_API_KEY for TEST
npm run secrets:set:prod   # Set GEMINI_API_KEY for PROD
```

## Cloud Tasks Architecture

### Why Cloud Tasks for TEST & PROD?

| Feature | Direct Processing (DEV) | Cloud Tasks (TEST/PROD) |
|---------|------------------------|-------------------------|
| **Timeout** | 9 minutes max | 60 minutes max |
| **Retries** | None | Automatic with backoff |
| **Rate Limiting** | None | Max 3 concurrent |
| **Error Handling** | Basic | Advanced with retries |
| **Scalability** | Limited | Highly scalable |
| **Cost** | Free (emulator) | Minimal ($) |

### How Processing Works

#### DEV (Emulator)
```
1. Upload file → Storage
2. Storage trigger fires
3. Cloud Function processes directly
4. Article created
```

#### TEST & PROD
```
1. Upload file → Storage
2. Storage trigger fires
3. Cloud Task enqueued (function returns immediately)
4. Task queue processes podcast (async)
5. Article created
6. Quota incremented
```

## Code Behavior

The code automatically detects the environment:

```typescript
// In onPodcastUploaded.ts
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";

if (isEmulator) {
  // DEV: Process directly
  processPodcast(podcastId, filePath);
} else {
  // TEST/PROD: Use Cloud Tasks
  enqueueProcessingTask(podcastId, filePath);
}
```

**You don't need to change any code!** The same codebase works for all three environments.

## Environment Variables

### Required for All Environments

| Variable | DEV | TEST | PROD | Notes |
|----------|-----|------|------|-------|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | demo-echoscribe | echoscribe-test | echoscribe-prod | Firebase project |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | true | false | false | Emulator flag |
| `GEMINI_API_KEY` | .env file | Firebase Secret | Firebase Secret | AI processing |
| Stripe keys | Test mode | Test mode | **Live mode** | Payments |

### Stripe Environment Variables

#### All Environments
| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `STRIPE_SECRET_KEY` | Stripe secret key for API calls | Stripe Dashboard > Developers > API Keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Stripe Dashboard > Developers > Webhooks |

#### Pricing Tier Price IDs (Required for New Multi-Tier System)
| Variable | Description | Notes |
|----------|-------------|-------|
| `STRIPE_PRICE_ID_STARTER_MONTHLY` | Price ID for Starter tier (€9.99/month, 15 podcasts) | Create in Stripe Dashboard |
| `STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY` | Price ID for Professional tier (€24.99/month, 60 podcasts) | Create in Stripe Dashboard |
| `STRIPE_PRICE_ID_BUSINESS_MONTHLY` | Price ID for Business tier (€49.99/month, 150 podcasts) | Create in Stripe Dashboard |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | (Legacy) Old Pro tier price ID | Optional, kept for backward compatibility |

**How to create Stripe Price IDs:**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/) > Products
2. Create a new product or use existing "EchoScribe" product
3. Add prices for each tier:
   - **Starter:** €9.99/month, recurring
   - **Professional:** €24.99/month, recurring
   - **Business:** €49.99/month, recurring
4. Copy each Price ID (starts with `price_...`) to your `.env` file
5. Set the same Price IDs in your `.env.test` (use test mode prices) and `.env.production` (use live mode prices)

### Firebase Admin Credentials

| Environment | Method | Notes |
|-------------|--------|-------|
| DEV | Not needed | Emulator doesn't require auth |
| TEST | Service Account | Download from Firebase Console |
| PROD | Service Account OR Workload Identity | Workload Identity for Cloud Functions |

## Security Checklist

- [ ] `.env.test` and `.env.production` are in `.gitignore`
- [ ] Never commit real credentials to git
- [ ] Use Firebase Secrets for GEMINI_API_KEY in TEST/PROD
- [ ] Use Stripe TEST keys in TEST environment
- [ ] Use Stripe LIVE keys in PROD environment (carefully!)
- [ ] Rotate keys regularly
- [ ] Monitor Firebase Console for unusual activity

## Deployment Workflow

### Development → Testing → Production

```bash
# 1. Develop locally
npm run emulators
npm run dev

# 2. Deploy to TEST for validation
npm run firebase:use:test
npm run deploy:test

# 3. Test thoroughly in TEST environment
# - Upload podcasts
# - Test payments
# - Check Cloud Tasks processing
# - Verify quota system

# 4. Deploy to PROD
npm run firebase:use:prod
npm run deploy:prod

# 5. Monitor production
firebase functions:log
```

## Troubleshooting

### "Cloud Tasks not working"
- ✅ Verify you're NOT in emulator mode
- ✅ Check Cloud Tasks API is enabled in Google Cloud Console
- ✅ Verify region is `europe-west1`
- ✅ Check function logs: `firebase functions:log`

### "Gemini API errors"
- ✅ Verify secret is set: `firebase functions:secrets:access GEMINI_API_KEY`
- ✅ Check API quota in Google AI Studio
- ✅ For DEV: Check `functions/.env` has `GEMINI_API_KEY`

### "Authentication issues"
- ✅ Verify `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` is correct
- ✅ Check Firebase Console > Authentication > Sign-in method
- ✅ Verify authorized domains

## Cost Estimation

### DEV (Emulator)
- **Cost:** $0 (everything runs locally)

### TEST (Real Firebase)
- **Firestore:** ~$0.01-0.10/month (light usage)
- **Storage:** ~$0.01-0.05/month (few test files)
- **Functions:** ~$0.10-0.50/month (pay-as-you-go)
- **Cloud Tasks:** ~$0.01/month (minimal)
- **Gemini API:** ~$0.50-2.00/month (depends on testing volume)
- **Total:** ~$1-3/month

### PROD (Real Firebase)
- Depends on user volume
- Firebase has generous free tier
- Monitor usage in Firebase Console

## Next Steps

1. ✅ Environment configuration complete
2. ⏭️ Create TEST and PROD Firebase projects
3. ⏭️ Configure `.env.test` with TEST project values
4. ⏭️ Configure `.env.production` with PROD project values
5. ⏭️ Set Gemini API key secrets for TEST and PROD
6. ⏭️ Deploy to TEST and validate
7. ⏭️ Deploy to PROD when ready

## Support

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)
