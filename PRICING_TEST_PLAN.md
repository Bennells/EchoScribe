# EchoScribe - Pricing Implementation Test Plan

## ✅ Configuration Complete

Your Stripe Price IDs have been configured in `.env.local`:
- **Starter**: `price_1SLdexGiTikY0Uun6TD0JdqT` (€9.99/month, 15 podcasts)
- **Professional**: `price_1SK0kNGiTikY0UunQylyU5dO` (€24.99/month, 60 podcasts)
- **Business**: `price_1SK0lNGiTikY0UunzrxOrkWU` (€49.99/month, 150 podcasts)

## Quick Start Testing

### 1. Start the Development Server

```bash
npm run dev
```

The app should start on `http://localhost:3000`

### 2. Test Public Pricing Page

**URL:** `http://localhost:3000/pricing`

**What to check:**
- [ ] All 4 tiers are displayed (Free, Starter, Professional, Business)
- [ ] "Professional" tier has "Beliebteste Wahl" badge
- [ ] Prices are correct (€0, €9.99, €24.99, €49.99)
- [ ] Features list is visible for each tier
- [ ] FAQ section is displayed below
- [ ] CTA section at bottom works
- [ ] Responsive layout works on mobile/tablet/desktop

**Actions to test:**
- Click "Jetzt starten" on Free tier → Should redirect to `/register`
- Click "Jetzt starten" on paid tiers → Should redirect to `/register`

### 3. Test Dashboard Pricing (Authenticated)

**Steps:**
1. Register a new account or log in
2. Navigate to the sidebar → Click "Preise"

**URL:** `http://localhost:3000/dashboard/pricing`

**What to check:**
- [ ] "Ihr aktueller Plan" card shows "Free Tier"
- [ ] Quota usage is displayed (e.g., "0 / 3 Podcasts verwendet")
- [ ] All 4 pricing tiers are shown
- [ ] Free tier button says "Aktueller Plan" and is disabled
- [ ] Paid tier buttons say "Jetzt upgraden"
- [ ] Plan management information section is visible

**Actions to test:**
- Click "Jetzt upgraden" on Starter → Should redirect to Stripe Checkout

### 4. Test Stripe Checkout Flow

**Steps:**
1. From dashboard pricing page, click "Jetzt upgraden" on Starter tier
2. You should be redirected to Stripe Checkout

**Test Card Details:**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**What to check:**
- [ ] Stripe Checkout page loads
- [ ] Price shown is €9.99/month (for Starter)
- [ ] Can enter test card details
- [ ] Checkout completes successfully
- [ ] Redirected back to `/dashboard/settings?success=true`

### 5. Verify Tier Upgrade

After completing checkout, verify the upgrade worked:

**In Dashboard:**
- [ ] Sidebar shows "Starter" (not "Free Tier")
- [ ] Settings page shows "Starter" as "Konto-Typ"
- [ ] Quota shows "0 / 15 Podcasts verwendet"
- [ ] Subscription status shows "Aktiv"

**In Stripe Dashboard:**
- [ ] Go to https://dashboard.stripe.com/test/subscriptions
- [ ] Find your subscription
- [ ] Verify price is €9.99
- [ ] Verify metadata contains: `tier: starter`

**In Firestore (Firebase Console):**
- [ ] Go to Firestore Database
- [ ] Find your user document in `users` collection
- [ ] Check fields:
  - `tier: "starter"`
  - `subscriptionStatus: "active"`
  - `quota.monthly: 15`
  - `quota.used: 0`
  - `quota.resetAt: [timestamp]`
- [ ] Find subscription document in `subscriptions` collection
- [ ] Check `tier: "starter"`

### 6. Test Settings Page Integration

**URL:** `http://localhost:3000/dashboard/settings`

**For Free Users:**
- [ ] Shows "Free Tier (3 Podcasts insgesamt)"
- [ ] Subscription section shows upgrade options
- [ ] Lists all three paid tiers
- [ ] "Pläne ansehen & upgraden" button links to `/dashboard/pricing`

**For Subscribed Users:**
- [ ] Shows correct tier name (e.g., "Starter")
- [ ] Shows quota usage
- [ ] "Abonnement verwalten" button opens Stripe Portal
- [ ] "Andere Pläne ansehen" button links to `/dashboard/pricing`

### 7. Test Tier Changes

**Upgrade from Starter to Professional:**
1. Navigate to `/dashboard/pricing`
2. Click "Jetzt upgraden" on Professional tier
3. Complete checkout with test card
4. Verify:
   - [ ] Sidebar shows "Professional"
   - [ ] Quota changed to "0 / 60"
   - [ ] Firestore updated to `tier: "professional"`, `quota.monthly: 60`

**Upgrade from Professional to Business:**
1. Navigate to `/dashboard/pricing`
2. Click "Jetzt upgraden" on Business tier
3. Complete checkout with test card
4. Verify:
   - [ ] Sidebar shows "Business"
   - [ ] Quota changed to "0 / 150"
   - [ ] Firestore updated to `tier: "business"`, `quota.monthly: 150`

### 8. Test Subscription Cancellation

1. Go to `/dashboard/settings`
2. Click "Abonnement verwalten"
3. In Stripe Portal, cancel subscription
4. After cancellation webhook processes, verify:
   - [ ] User reverts to "Free Tier"
   - [ ] Quota reverts to "0 / 3"
   - [ ] `subscriptionStatus: "canceled"` in Firestore
   - [ ] `tier: "free"` in Firestore

### 9. Test Webhook Events

**To test webhooks locally:**

1. Install Stripe CLI:
   ```bash
   stripe login
   ```

2. Forward webhooks to local:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. Copy the webhook signing secret and update `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

4. Trigger test events:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger customer.subscription.updated
   stripe trigger customer.subscription.deleted
   ```

5. Check console logs to verify webhook processing

### 10. Test Quota System

**Test quota enforcement:**

1. As a Free user (3 podcasts lifetime):
   - [ ] Upload 1st podcast → Should succeed
   - [ ] Upload 2nd podcast → Should succeed
   - [ ] Upload 3rd podcast → Should succeed
   - [ ] Try 4th upload → Should be blocked with quota error

2. Upgrade to Starter (15 podcasts/month):
   - [ ] Quota resets to 0/15
   - [ ] Can upload up to 15 podcasts
   - [ ] 16th upload should be blocked

3. Test monthly reset (simulate):
   - [ ] Manually update `quota.resetAt` to past date in Firestore
   - [ ] Trigger `customer.subscription.updated` webhook
   - [ ] Verify `quota.used` resets to 0

## Known Limitations & Notes

### Current Behavior:
- **Free tier**: 3 podcasts total (lifetime), no monthly reset
- **Paid tiers**: Monthly quota that resets at billing period
- **Quota reset**: Happens via Stripe webhook `customer.subscription.updated`
- **Downgrades**: Must be done through Stripe Portal (cancellation)

### Not Implemented Yet:
- [ ] Automatic quota reset via scheduled Cloud Function (cron)
- [ ] Email notifications for quota warnings
- [ ] Annual billing options
- [ ] Grace period after quota exceeded
- [ ] Proration for mid-cycle plan changes
- [ ] Team/multi-user accounts

## Production Deployment Checklist

Before deploying to production:

1. **Create LIVE Mode Prices in Stripe:**
   - [ ] Switch Stripe Dashboard to LIVE mode
   - [ ] Create 3 products/prices (Starter, Professional, Business)
   - [ ] Copy LIVE price IDs

2. **Update Production Environment:**
   - [ ] Update `.env.production` with LIVE price IDs
   - [ ] Use LIVE Stripe API keys
   - [ ] Set up production webhook endpoint
   - [ ] Test webhook with Stripe CLI in LIVE mode

3. **Verify Webhook Endpoint:**
   - [ ] Add webhook endpoint in Stripe Dashboard
   - [ ] URL: `https://yourdomain.com/api/webhooks/stripe`
   - [ ] Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

4. **Test in Production:**
   - [ ] Small test purchase with real card
   - [ ] Verify Firestore updates
   - [ ] Test cancellation flow
   - [ ] Verify quota management

## Troubleshooting

### Issue: Checkout redirects but tier doesn't update
**Solution:** Check webhook logs in Stripe Dashboard and Firebase Functions logs

### Issue: "Missing Stripe Price ID" error
**Solution:** Verify all environment variables are set correctly in `.env.local`

### Issue: Quota doesn't reset monthly
**Solution:** Check `customer.subscription.updated` webhook is firing and processing correctly

### Issue: Sidebar still shows "Free Tier" after upgrade
**Solution:** Refresh the page or check Firestore for tier field update

### Issue: Can't access pricing page
**Solution:** Ensure `npm run dev` is running and no TypeScript errors

## Support Resources

- **Stripe Test Cards:** https://stripe.com/docs/testing
- **Stripe Webhook Testing:** https://stripe.com/docs/webhooks/test
- **Firebase Firestore Console:** https://console.firebase.google.com/
- **Implementation Docs:** [PRICING_IMPLEMENTATION.md](./PRICING_IMPLEMENTATION.md)
- **Environment Setup:** [ENVIRONMENTS.md](./ENVIRONMENTS.md)

---

**Last Updated:** 2025-10-24
**Status:** Ready for Testing
**Configured:** ✅ Test Mode Price IDs Set
