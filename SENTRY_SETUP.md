# Sentry Setup & Configuration Guide

## Overview

This guide explains how to set up Sentry error tracking for EchoScribe in **production only**. Sentry is disabled in development and test environments to avoid noise and save quota.

---

## 1. Create Sentry Account

### Step 1: Sign Up
1. Go to https://sentry.io/signup/
2. Sign up with your email or GitHub account
3. Choose a plan:
   - **Free Tier**: 5,000 errors/month (perfect for getting started)
   - **Developer**: $26/month for 50,000 errors (upgrade later if needed)

### Step 2: Create Project
1. After signup, click "Create Project"
2. **Platform**: Select "Next.js"
3. **Project Name**: `echoscribe` or `echoscribe-prod`
4. **Alert Frequency**: Choose "Alert me on every new issue" (recommended)
5. Click "Create Project"

### Step 3: Get Your DSN
After project creation, you'll see:

```
SENTRY_DSN: https://abc123def456...@o789.ingest.sentry.io/1234567
```

**Copy this DSN** - you'll need it for environment variables.

---

## 2. Create Auth Token (for Source Maps)

Source maps allow Sentry to show readable error stack traces with your actual filenames and line numbers.

### Steps:
1. Click your profile icon → "Settings"
2. Navigate to "Account" → "Auth Tokens"
3. Click "Create New Token"
4. **Name**: `echoscribe-sourcemaps`
5. **Scopes**: Check these boxes:
   - `project:releases`
   - `project:write`
   - `org:read`
6. Click "Create Token"
7. **Copy the token immediately** (you won't see it again!)

---

## 3. Optional: Create Separate Project for Cloud Functions

You can use one Sentry project for everything, or create a separate project for Cloud Functions.

**Option A: Single Project (Recommended for Start)**
- Use the same DSN for both Next.js and Cloud Functions
- All errors in one place
- Easier to manage initially

**Option B: Separate Projects**
1. Create new project with platform "Node.js"
2. Name it `echoscribe-functions`
3. Get a second DSN for Cloud Functions
4. Better separation for production

For this guide, we'll use **Option A (single project)**.

---

## 4. Configure Environment Variables

### For Production Deployment

#### Next.js (Frontend & API Routes)

Create or update `.env.production`:

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://abc123...@o789.ingest.sentry.io/1234567
SENTRY_ORG=your-org-slug  # Found in Sentry Settings → Organization Settings
SENTRY_PROJECT=echoscribe  # Your project slug
SENTRY_AUTH_TOKEN=sntrys_YOUR_AUTH_TOKEN_HERE

# Firebase Production Config (existing)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# ... rest of your Firebase config

# Stripe Production Keys (existing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### Cloud Functions

Add to Firebase Secrets (recommended for production):

```bash
# Using Firebase CLI
firebase use prod
firebase functions:secrets:set SENTRY_DSN
# Paste your DSN when prompted: https://abc123...@o789.ingest.sentry.io/1234567
```

**OR** create `functions/.env` (not recommended for production):

```bash
SENTRY_DSN=https://abc123...@o789.ingest.sentry.io/1234567
```

---

## 5. Deploy to Production

### Build & Deploy Next.js

```bash
# Build with source maps
npm run build

# Deploy to your hosting platform
# Example for Vercel:
vercel --prod

# Example for Firebase Hosting:
firebase deploy --only hosting --project prod
```

During build, Sentry will:
1. Generate source maps
2. Upload them to Sentry
3. Remove them from production bundle (for security)

You should see output like:
```
✓ Uploading source maps to Sentry
✓ 42 source maps uploaded successfully
```

### Deploy Cloud Functions

```bash
# Deploy functions
firebase deploy --only functions --project prod
```

---

## 6. Test Sentry Integration

### Test 1: Frontend Error

Add a temporary error to test Sentry is working:

1. Create a test page `app/test-sentry/page.tsx`:

```typescript
"use client";

export default function TestSentry() {
  return (
    <button
      onClick={() => {
        throw new Error("Test Sentry Error from Frontend");
      }}
    >
      Trigger Error
    </button>
  );
}
```

2. Visit `https://your-domain.com/test-sentry` in production
3. Click the button
4. Check Sentry dashboard - error should appear within seconds

### Test 2: API Route Error

Test Stripe webhook error tracking:

```bash
# Trigger a test webhook with invalid data
curl -X POST https://your-domain.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": "invalid"}'
```

Check Sentry for the error.

### Test 3: Cloud Function Error

Manually trigger an error in Cloud Functions by uploading a corrupted audio file, then check Sentry.

---

## 7. Configure Alerts

### Email Alerts

By default, you'll receive emails for every new error. To customize:

1. Go to your Sentry project
2. Click "Alerts" → "Alert Rules"
3. Click "Create Alert"
4. Choose trigger conditions:
   - **When**: "An event is first seen"
   - **Then**: Send email notification
5. Click "Save Rule"

### Recommended Alert Rules

**Critical Errors:**
```
Name: Critical Production Errors
When: Event is first seen AND error.level is fatal
Then: Send email to dev@yourdomain.com
```

**High Frequency Errors:**
```
Name: High Error Rate
When: Number of events > 10 in 1 hour
Then: Send email notification
```

**Webhook Failures:**
```
Name: Stripe Webhook Failures
When: Event is first seen AND webhook_handler is stripe
Then: Send email notification
```

---

## 8. Sentry Dashboard Tour

### Issues Tab
- See all errors grouped by similarity
- Click an issue to see:
  - Error message and stack trace
  - User context (userId, email)
  - Breadcrumbs (user actions before error)
  - Device/browser info
  - Tags for filtering

### Performance Tab (Optional)
- See slow transactions
- Identify performance bottlenecks
- Optimize based on real user data

### Releases Tab
- Track errors per deployment
- See which release introduced an error
- Compare error rates between versions

---

## 9. Understanding Error Context

### Frontend Errors

When an error occurs in the browser, Sentry captures:

```json
{
  "error": "TypeError: Cannot read property 'id' of undefined",
  "location": "app/dashboard/page.tsx:42",
  "user": {
    "id": "user_abc123",
    "email": "user@example.com"
  },
  "breadcrumbs": [
    {
      "timestamp": "2025-01-15T14:20:00Z",
      "message": "User logged in",
      "category": "auth"
    },
    {
      "timestamp": "2025-01-15T14:23:45Z",
      "message": "Navigated to /dashboard",
      "category": "navigation"
    },
    {
      "timestamp": "2025-01-15T14:25:10Z",
      "message": "Clicked upload button",
      "category": "ui.click"
    }
  ],
  "tags": {
    "location": "dashboard"
  }
}
```

### Cloud Function Errors

When a Cloud Function fails, Sentry captures:

```json
{
  "error": "GeminiAPIError: Rate limit exceeded",
  "function": "processPodcastTask",
  "user": {
    "id": "user_abc123"
  },
  "contexts": {
    "function": {
      "name": "processPodcastTask",
      "attemptNumber": 3
    },
    "podcast": {
      "id": "podcast_xyz789"
    }
  },
  "extra": {
    "storagePath": "podcasts/user_abc123/episode.mp3",
    "maxAttempts": 5,
    "isLastAttempt": false
  }
}
```

---

## 10. Ignoring Known Errors

Some errors are expected or not actionable. You can ignore them:

### In Sentry Dashboard:
1. Find the error in "Issues"
2. Click "Ignore" → "Ignore until this happens again"
3. Or set ignore conditions (e.g., "Ignore for this user")

### In Code:

Update `sentry.client.config.ts`:

```typescript
beforeSend(event, hint) {
  const error = hint.originalException;

  // Ignore browser extension errors
  if (error && typeof error === "string") {
    if (error.includes("chrome-extension://")) {
      return null; // Don't send to Sentry
    }
  }

  // Ignore specific error types
  if (event.exception?.values?.[0]?.type === "ChunkLoadError") {
    return null; // Ignore Next.js chunk load errors
  }

  return event;
}
```

---

## 11. Troubleshooting

### Problem: No errors appearing in Sentry

**Check:**
1. Is `NEXT_PUBLIC_SENTRY_DSN` set in `.env.production`?
2. Is `NODE_ENV` set to `"production"`?
3. Did you deploy after setting env vars?
4. Check browser console for Sentry initialization errors

**Debug:**
```typescript
// Add to sentry.client.config.ts
Sentry.init({
  dsn: SENTRY_DSN,
  debug: true, // Enable debug logging
});
```

### Problem: Source maps not uploading

**Check:**
1. Is `SENTRY_AUTH_TOKEN` set correctly?
2. Does the token have `project:releases` and `project:write` scopes?
3. Is `SENTRY_ORG` and `SENTRY_PROJECT` correct?

**Debug:**
```bash
# Build with verbose output
SENTRY_LOG_LEVEL=debug npm run build
```

### Problem: Too many errors (quota exceeded)

**Solutions:**
1. Increase sample rate in config:
   ```typescript
   tracesSampleRate: 0.1, // Only 10% of transactions
   ```
2. Add `beforeSend` filters to ignore non-critical errors
3. Upgrade to paid plan
4. Group similar errors by setting `fingerprint`

### Problem: Cloud Function errors not appearing

**Check:**
1. Is `SENTRY_DSN` set in Firebase Functions secrets?
   ```bash
   firebase functions:secrets:access SENTRY_DSN
   ```
2. Are errors being thrown correctly?
3. Check Cloud Functions logs for Sentry initialization message

---

## 12. Best Practices

### DO:
✅ Set up alerts for critical errors only (avoid alert fatigue)
✅ Add user context when possible (userId, email)
✅ Use tags to categorize errors (e.g., `location: "dashboard"`)
✅ Review Sentry weekly to identify patterns
✅ Create issues/tickets from Sentry errors
✅ Use releases to track which deployment introduced errors

### DON'T:
❌ Enable Sentry in development (use console.log instead)
❌ Ignore all errors blindly (even "minor" errors matter)
❌ Send sensitive data (passwords, tokens) to Sentry
❌ Leave debug mode on in production
❌ Forget to update error filters as app evolves

---

## 13. Costs & Quotas

### Free Tier:
- 5,000 errors/month
- 1 member
- 30-day retention
- Email alerts

**Estimate for EchoScribe:**
- ~100-500 errors/month (if stable)
- Free tier should be sufficient for first 6 months

### When to Upgrade:
- Exceeding 5,000 errors/month regularly
- Need more than 30-day retention
- Want Slack/Discord integrations
- Need performance monitoring

---

## 14. Integration with Other Tools

### Slack Integration (Optional)
1. Sentry → Settings → Integrations → Slack
2. Connect your Slack workspace
3. Choose which errors to send to Slack

### GitHub Integration (Optional)
1. Sentry → Settings → Integrations → GitHub
2. Connect repository
3. Create GitHub issues directly from Sentry errors
4. See which commit introduced the error

---

## 15. Support & Resources

- **Sentry Docs**: https://docs.sentry.io/
- **Next.js Integration**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Node.js (Functions)**: https://docs.sentry.io/platforms/node/
- **Community**: https://discord.gg/sentry

---

## Summary Checklist

Before deploying to production:

- [ ] Created Sentry account
- [ ] Created project (Next.js platform)
- [ ] Copied DSN and auth token
- [ ] Set `NEXT_PUBLIC_SENTRY_DSN` in `.env.production`
- [ ] Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in `.env.production`
- [ ] Set `SENTRY_DSN` in Firebase Functions secrets
- [ ] Deployed Next.js with `npm run build`
- [ ] Deployed Cloud Functions with `firebase deploy --only functions`
- [ ] Tested error tracking (frontend, API, functions)
- [ ] Configured email alerts
- [ ] Set up ignored errors (if needed)
- [ ] Reviewed Sentry dashboard

---

**Last Updated:** 2025-01-15
**Version:** 1.0
**Environment:** Production Only
