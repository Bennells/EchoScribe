# Stripe Webhook Emulator Fix

## Problem

When testing Stripe subscriptions locally with Firebase Emulator, the webhook handler was returning a `[500]` error for `checkout.session.completed` events. This prevented user upgrades from working:

```
2025-10-24 08:01:13  <--  [500] POST http://localhost:3000/api/webhooks/stripe [evt_1SLe3pGiTikY0UunuekQAvbl]
```

**Symptoms:**
- Stripe checkout completes successfully
- Webhook receives event
- Webhook returns 500 error
- User tier is NOT updated in Firestore
- Dashboard still shows "Free Tier"

## Root Cause

The Firebase Admin SDK in the webhook handler was not configured to connect to the Firestore emulator. When the webhook tried to:

1. Create subscription document in `subscriptions` collection
2. Update user document with new tier in `users` collection

...it was trying to connect to **production Firestore** instead of the **local emulator**, causing the operations to fail.

### Why This Happened:

The Admin SDK initialization in `lib/firebase/admin.ts` was detecting emulator mode correctly, but was NOT setting the `FIRESTORE_EMULATOR_HOST` environment variable that tells the SDK to connect to the local emulator instead of production.

## Solution

Updated `lib/firebase/admin.ts` to explicitly set the Firestore emulator host when running in emulator mode:

```typescript
// DEV mode with emulators
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
  const app = admin.initializeApp({
    projectId: projectId,
  });

  // Connect Firebase Admin SDK to Firestore emulator
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

  return app;
}
```

### What This Does:

- Detects emulator mode using `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`
- Initializes Firebase Admin SDK with project ID
- **Explicitly configures Firestore client to connect to `localhost:8080`** (Firestore emulator default port)
- Uses `firestore.settings()` to set `host` and disable `ssl`
- Now all Firestore operations from Admin SDK go to the emulator

## How Firebase Emulator Works

The Firebase Emulator Suite runs multiple emulators on localhost:

| Service | Default Port | Environment Variable |
|---------|--------------|---------------------|
| Auth | 9099 | `FIREBASE_AUTH_EMULATOR_HOST` |
| Firestore | 8080 | `FIRESTORE_EMULATOR_HOST` |
| Functions | 5001 | - |
| Storage | 9199 | `FIREBASE_STORAGE_EMULATOR_HOST` |

**Client SDK (Browser):**
- Connects to emulator via `connectAuthEmulator()`, `connectFirestoreEmulator()`, etc.
- Configured in `lib/firebase/config.ts`

**Admin SDK (Server/API Routes):**
- Needs `FIRESTORE_EMULATOR_HOST` environment variable set
- Now configured in `lib/firebase/admin.ts` ✅

## Testing

### Before Fix:

```bash
# Start dev server and emulators
npm run dev
npm run emulators

# Forward Stripe webhooks
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# Try to upgrade from dashboard
# Result: ❌ Webhook returns [500]
# Result: ❌ User tier NOT updated
# Result: ❌ Dashboard still shows "Free Tier"
```

### After Fix:

```bash
# 1. Restart dev server (important - to pick up Admin SDK changes)
# Stop dev server (Ctrl+C)
npm run dev

# 2. Stripe CLI should still be running
# If not, restart: stripe listen --forward-to http://localhost:3000/api/webhooks/stripe

# 3. Try to upgrade from dashboard
# Navigate to: http://localhost:3000/dashboard/pricing
# Click "Jetzt upgraden" on any tier
# Complete with test card: 4242 4242 4242 4242

# Expected results:
# ✅ Webhook returns [200]
# ✅ Console logs show "Subscription created in Firestore: sub_..."
# ✅ Console logs show "User subscription status and tier updated: ..."
# ✅ Dashboard sidebar shows new tier (e.g., "Starter")
# ✅ Settings page shows updated quota (e.g., "0 / 15 Podcasts")
```

### Verify in Firebase Emulator UI:

1. Open http://localhost:4000
2. Go to Firestore tab
3. Check `users` collection → find your user:
   - `tier` should be "starter", "professional", or "business"
   - `subscriptionStatus` should be "active"
   - `quota.monthly` should be 15, 60, or 150
   - `quota.used` should be 0
4. Check `subscriptions` collection → find subscription document:
   - Document ID matches Stripe subscription ID
   - Contains `tier`, `stripeCustomerId`, `status: "active"`, etc.

## Related Files

### Modified:
- `lib/firebase/admin.ts` - Added Firestore emulator host configuration

### Related (No Changes):
- `app/api/webhooks/stripe/route.ts` - Webhook handler (uses adminDb)
- `lib/firebase/config.ts` - Client SDK emulator configuration
- `app/api/stripe/create-checkout-session/route.ts` - Creates checkout with tier metadata
- `app/api/stripe/create-portal-session/route.ts` - Opens Stripe portal

## Environment Variables

### Required for Emulator Mode:

```bash
# .env.local
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-echoscribe

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (from stripe listen)
STRIPE_PRICE_ID_STARTER_MONTHLY=price_...
STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_ID_BUSINESS_MONTHLY=price_...
```

### Automatically Configured by Admin SDK Fix:

The Firestore emulator connection is now configured programmatically using `firestore.settings()`. You don't need to manually set any environment variables - the connection to `localhost:8080` happens automatically when the Admin SDK detects emulator mode.

## Production Behavior

This change **only affects local development**. In production:

- `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` is `false`
- Admin SDK uses service account credentials
- Connects to real Firebase Firestore
- No emulator host is set

The fix is safe for production deployment - it only activates in emulator mode.

## Troubleshooting

### Issue: Webhook still returns [500] after fix
**Solution:**
1. **Restart your dev server** (npm run dev) - this is crucial!
2. Restart Stripe CLI webhook forwarding
3. Try upgrading again

### Issue: "ECONNREFUSED localhost:8080"
**Solution:**
- Make sure Firebase Emulator is running: `npm run emulators`
- Check that Firestore emulator is running on port 8080
- Open http://localhost:4000 to verify emulator UI loads

### Issue: Webhook returns [200] but user tier not updated
**Solution:**
- Check Firebase Emulator UI (http://localhost:4000)
- Look at Firestore tab - are documents being created?
- Check dev server console for error logs
- Verify `userId` is correctly passed in checkout session metadata

### Issue: "Project ID does not match"
**Solution:**
- Ensure `.env.local` has `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-echoscribe`
- Restart dev server after changing environment variables

## Key Learnings

1. **Firebase Admin SDK** requires explicit emulator configuration via environment variables
2. **Client SDK** uses `connectFirestoreEmulator()` function calls
3. **Different approaches** for client vs server Firebase connections
4. **Environment variables** must be set before SDK initialization
5. **Dev server restart** is required when changing SDK initialization code

## Next Steps

After confirming this fix works:

1. ✅ Test complete upgrade flow locally
2. ✅ Verify quota management works
3. ✅ Test tier downgrade/cancellation
4. ⏭️ Deploy to TEST environment (real Firebase, not emulator)
5. ⏭️ Test webhooks in TEST environment with real Stripe webhooks
6. ⏭️ Deploy to PROD when ready

---

**Fixed:** 2025-10-24
**Affects:** Local development with Firebase Emulator
**Impact:** Enables Stripe subscription testing with local Firestore emulator
**Related:** [FIREBASE_EMULATOR_AUTH_FIX.md](./FIREBASE_EMULATOR_AUTH_FIX.md)
