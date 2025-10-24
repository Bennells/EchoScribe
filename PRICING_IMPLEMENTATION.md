# EchoScribe - Pricing Implementation Summary

## Overview

The EchoScribe pricing system has been expanded from a simple Free/Pro model to a comprehensive four-tier pricing structure with Free, Starter, Professional, and Business plans.

## Pricing Tiers

| Tier | Price | Podcasts/Month | Cost per Podcast |
|------|-------|----------------|------------------|
| **Free** | €0 | 3 lifetime | - |
| **Starter** | €9.99/month | 15 podcasts/month | €0.67 |
| **Professional** | €24.99/month | 60 podcasts/month | €0.42 |
| **Business** | €49.99/month | 150 podcasts/month | €0.33 |

## Implementation Details

### 1. New Components Created

#### Pricing Cards Component
**File:** `components/features/pricing/pricing-cards.tsx`

- Reusable pricing cards component
- Shows all four tiers (Free, Starter, Professional, Business)
- Highlights "Most Popular" (Professional tier)
- Adapts button text based on authentication status
- Handles tier selection and checkout initiation
- Responsive grid layout (1 col mobile, 2 cols tablet, 4 cols desktop)

### 2. New Pages Created

#### Public Pricing Page
**File:** `app/pricing/page.tsx`

- Publicly accessible pricing page at `/pricing`
- Hero section with headline
- Pricing cards grid
- FAQ section covering common questions
- CTA section
- Header with login/register links
- Footer with legal links

#### Dashboard Pricing Page
**File:** `app/dashboard/pricing/page.tsx`

- Dashboard-accessible pricing page at `/dashboard/pricing`
- Shows current plan status
- Displays quota usage
- Allows authenticated users to upgrade/change plans
- Plan management information section
- Integration with Stripe checkout

### 3. Updated Backend APIs

#### Stripe Checkout API
**File:** `app/api/stripe/create-checkout-session/route.ts`

**Changes:**
- Accepts `tier` parameter in request body
- Maps tier to appropriate Stripe Price ID
- Supports legacy "pro" tier for backward compatibility
- Passes tier in session metadata
- Added SEPA debit as payment method

**Environment Variables Required:**
```
STRIPE_PRICE_ID_STARTER_MONTHLY
STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY
STRIPE_PRICE_ID_BUSINESS_MONTHLY
```

#### Stripe Webhook Handler
**File:** `app/api/webhooks/stripe/route.ts`

**Changes in `handleCheckoutSessionCompleted`:**
- Extracts tier from session metadata
- Maps tier to quota limits (15/60/150)
- Stores tier in subscription document
- Updates user document with tier and quota
- Resets quota.used to 0 on new subscription

**Changes in `handleSubscriptionUpdated`:**
- Detects new billing periods
- Automatically resets quota at period start
- Updates quota.resetAt timestamp
- Maintains tier information

**Changes in `handleSubscriptionDeleted`:**
- Reverts user to free tier
- Sets quota back to 3 (lifetime)
- Resets quota.used to 0

### 4. Type System Updates

#### User Type
**File:** `types/user.ts`

**Changes:**
- Added `UserTier` type: `"free" | "starter" | "professional" | "business"`
- Added optional `tier?: UserTier` field to User interface

#### Subscription Type
**File:** `types/subscription.ts`

**Changes:**
- Added optional `tier?: UserTier` field to Subscription interface
- Imported UserTier from user types

### 5. Quota System Updates

#### Quota Logic
**File:** `lib/firebase/quota.ts`

**Changes:**
- `getQuotaInfo()` now returns tier information
- Quota is based on tier-specific limits (not unlimited)
- Returns numeric total for all tiers including paid plans
- Simplified quota checking logic

### 6. UI Updates

#### Settings Page
**File:** `app/dashboard/settings/page.tsx`

**Changes:**
- Updated subscription management section
- Shows all three paid tiers with prices
- "Pläne ansehen & upgraden" button links to `/dashboard/pricing`
- Pro users see "Andere Pläne ansehen" button
- Removed hardcoded €19.99 price

#### Dashboard Layout
**File:** `app/dashboard/layout.tsx`

**Changes:**
- Added "Preise" navigation item with CreditCard icon
- Dynamic tier display in user section (instead of hardcoded "Free Tier")
- Loads tier info on mount using `getQuotaInfo()`
- Shows proper tier names: "Free Tier", "Starter", "Professional", "Business"

#### Landing Page
**File:** `app/page.tsx`

**Changes:**
- Added "Preise ansehen" button linking to `/pricing`
- Button positioned between "Jetzt starten" and "Anmelden"

### 7. Documentation Updates

#### Environment Documentation
**File:** `ENVIRONMENTS.md`

**New Section Added:**
- Stripe Environment Variables section
- Table of required Stripe Price IDs for each tier
- Step-by-step guide to create Stripe Price IDs
- Notes on test vs. live mode prices

## Database Schema Changes

### User Document
```typescript
{
  // ... existing fields
  tier?: "free" | "starter" | "professional" | "business",
  quota: {
    monthly: number,  // 3 for free, 15/60/150 for paid tiers
    used: number,
    resetAt: Timestamp  // Now actively used for paid tiers
  }
}
```

### Subscription Document
```typescript
{
  // ... existing fields
  tier?: "free" | "starter" | "professional" | "business"
}
```

## Next Steps - Action Items

### 1. Configure Stripe (Required)

You must create the Stripe products and prices before the system will work:

1. **Go to Stripe Dashboard** (use test mode for testing):
   - Navigate to Products
   - Create or select "EchoScribe" product

2. **Create Three Price Objects:**
   - **Starter Plan:**
     - Price: €9.99
     - Billing: Recurring monthly
     - Copy the Price ID (e.g., `price_1234starter...`)

   - **Professional Plan:**
     - Price: €24.99
     - Billing: Recurring monthly
     - Copy the Price ID (e.g., `price_1234prof...`)

   - **Business Plan:**
     - Price: €49.99
     - Billing: Recurring monthly
     - Copy the Price ID (e.g., `price_1234biz...`)

3. **Update Environment Variables:**

   Add to `.env.local` (for development with test mode):
   ```bash
   STRIPE_PRICE_ID_STARTER_MONTHLY=price_1234starter...
   STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_1234prof...
   STRIPE_PRICE_ID_BUSINESS_MONTHLY=price_1234biz...
   ```

   Add to `.env.production` (for production with live mode):
   ```bash
   STRIPE_PRICE_ID_STARTER_MONTHLY=price_LIVE_starter...
   STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_LIVE_prof...
   STRIPE_PRICE_ID_BUSINESS_MONTHLY=price_LIVE_biz...
   ```

### 2. Test the Implementation

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test the public pricing page:**
   - Visit `http://localhost:3000/pricing`
   - Verify all four tiers are displayed
   - Check responsive layout on mobile/tablet/desktop

3. **Test authentication flow:**
   - Click "Jetzt starten" as non-authenticated user
   - Should redirect to `/register`

4. **Test dashboard pricing:**
   - Log in as a user
   - Navigate to "Preise" in sidebar
   - Verify current tier is displayed
   - Try selecting a paid tier
   - Should redirect to Stripe Checkout

5. **Test Stripe checkout (with test mode):**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Complete checkout
   - Verify webhook updates user tier and quota
   - Check Firestore to confirm data is correct

### 3. Migration for Existing Users (if applicable)

If you have existing users with the old "Pro" tier, you'll need to migrate them:

```javascript
// Run this once in Firebase Console or as a migration script
// For each user with subscriptionStatus === "active"
await updateDoc(userRef, {
  tier: "professional",  // Map old Pro to Professional
  "quota.monthly": 60,
  "quota.used": 0  // Reset on migration
});
```

### 4. Monitor and Adjust

After deployment:

1. **Monitor Stripe Dashboard:**
   - Check successful subscriptions
   - Monitor failed payments
   - Review webhook events

2. **Monitor Firebase:**
   - Check Firestore for tier updates
   - Verify quota resets are working
   - Review Cloud Functions logs

3. **User Feedback:**
   - Monitor support requests
   - Track conversion rates
   - Analyze which tier is most popular

### 5. Future Enhancements (Optional)

Consider implementing:

1. **Annual Billing:**
   - Add annual pricing with discount (e.g., "Save 20%")
   - Create additional Stripe Price IDs
   - Update pricing cards component

2. **Usage Analytics:**
   - Track quota usage patterns
   - Identify users close to limits
   - Send upgrade suggestions

3. **Quota Alerts:**
   - Email notifications at 80% usage
   - In-app warnings when quota is low
   - Grace period before hard limit

4. **Tier Comparison Page:**
   - Detailed feature comparison table
   - Help users choose right tier
   - Interactive calculator

5. **Admin Dashboard:**
   - View all subscriptions
   - Manual tier adjustments
   - Revenue analytics

## Testing Checklist

- [ ] Public pricing page loads correctly
- [ ] Dashboard pricing page shows current tier
- [ ] Non-authenticated users can see pricing
- [ ] Authenticated users can select a tier
- [ ] Stripe checkout redirects correctly
- [ ] Webhook updates user tier and quota
- [ ] Quota resets at billing period end
- [ ] Cancellation reverts to free tier
- [ ] Dashboard sidebar shows correct tier
- [ ] Settings page shows tier options
- [ ] Mobile responsive layout works

## Rollback Plan

If you need to rollback to the old Pro/Free system:

1. **Revert backend files:**
   - `app/api/stripe/create-checkout-session/route.ts`
   - `app/api/webhooks/stripe/route.ts`

2. **Remove new pages:**
   - Delete `app/pricing/page.tsx`
   - Delete `app/dashboard/pricing/page.tsx`
   - Delete `components/features/pricing/pricing-cards.tsx`

3. **Revert UI changes:**
   - `app/dashboard/settings/page.tsx`
   - `app/dashboard/layout.tsx`
   - `app/page.tsx`

4. **Keep type updates:** They are backward compatible

## Support

For questions or issues:
- Check `ENVIRONMENTS.md` for environment configuration
- Review Stripe webhook logs in dashboard
- Check Firebase Functions logs
- Review this document for implementation details

---

**Implementation Date:** 2025-10-24
**Version:** 1.0
**Status:** Complete - Ready for testing
