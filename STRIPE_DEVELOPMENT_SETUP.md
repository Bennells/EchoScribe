# Stripe Development & Testing Setup Guide

This guide explains how to set up and test Stripe integration in different environments.

## Overview

EchoScribe uses Stripe for subscription management with three tiers:
- **Starter**: €9.99/month, 15 podcasts/month
- **Professional**: €24.99/month, 60 podcasts/month
- **Business**: €49.99/month, 150 podcasts/month

## Environment Setup

### 1. Local Development (localhost:3000)

#### Prerequisites
- Node.js and npm installed
- Stripe CLI installed ([Download here](https://stripe.com/docs/stripe-cli))
- Stripe test account

#### Step 1: Install Stripe CLI

**Windows:**
```bash
# Using Scoop
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
# Download and install from https://github.com/stripe/stripe-cli/releases
```

#### Step 2: Login to Stripe CLI
```bash
stripe login
```
This will open your browser to authenticate with your Stripe account.

#### Step 3: Configure Environment Variables

Your `.env.local` file should have:
```bash
# Stripe Test Keys (from Stripe Dashboard)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Webhook Secret (from stripe listen command - see Step 4)
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (from Stripe Dashboard > Products)
STRIPE_PRICE_ID_STARTER_MONTHLY=price_...
STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_ID_BUSINESS_MONTHLY=price_...
```

#### Step 4: Start Development Server with Webhooks

You need **TWO terminal windows**:

**Terminal 1** - Start Next.js dev server:
```bash
npm run dev
```

**Terminal 2** - Forward Stripe webhooks to localhost:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The `stripe listen` command will output a webhook signing secret like:
```
> Ready! Your webhook signing secret is whsec_abc123... (^C to quit)
```

**IMPORTANT:** Copy this `whsec_...` secret and add it to your `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

Then **restart your dev server** (Terminal 1) to pick up the new secret.

#### Step 5: Test the Integration

1. Open your app at `http://localhost:3000`
2. Sign up or log in
3. Go to Pricing page and select a tier
4. Use Stripe test card: `4242 4242 4242 4242` with any future expiry and CVC
5. In Terminal 2, you should see webhook events being received:
   ```
   2025-01-15 10:30:00  --> checkout.session.completed [evt_123...]
   2025-01-15 10:30:01  --> customer.subscription.updated [evt_456...]
   ```

#### Test Cards

Use these test cards from [Stripe Testing Docs](https://stripe.com/docs/testing):
- **Success:** `4242 4242 4242 4242`
- **Requires Authentication:** `4000 0027 6000 3184`
- **Declined:** `4000 0000 0000 0002`
- **Insufficient Funds:** `4000 0000 0000 9995`

### 2. Google App Hosting (Test Environment)

Your test environment connects to the same Firebase project (`echoscribe-test`) but needs webhooks configured in the Stripe Dashboard.

#### Step 1: Deploy Your App

```bash
git push  # Triggers Google App Hosting deployment
```

#### Step 2: Create Webhook in Stripe Dashboard

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "+ Add endpoint"
3. Enter your endpoint URL: `https://your-app.web.app/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click "Add endpoint"

#### Step 3: Get Webhook Secret

After creating the endpoint:
1. Click on the webhook endpoint
2. Click "Reveal" under "Signing secret"
3. Copy the `whsec_...` secret

#### Step 4: Store Secret in Google Secret Manager

```bash
# Create or update the secret
gcloud secrets create STRIPE_WEBHOOK_SECRET --data-file=- --project=echoscribe-test
# Or update existing:
gcloud secrets versions add STRIPE_WEBHOOK_SECRET --data-file=- --project=echoscribe-test
```

Then paste your webhook secret and press Ctrl+D (Windows) or Cmd+D (Mac).

#### Step 5: Grant Access to App Hosting

```bash
firebase apphosting:secrets:grantaccess STRIPE_WEBHOOK_SECRET --project=echoscribe-test
```

#### Step 6: Redeploy

Push a new commit or manually trigger a rollout to pick up the new secret.

### 3. Production Environment

**IMPORTANT:** For production, use **live mode** keys (not test mode):

1. Switch to live mode in Stripe Dashboard
2. Get live keys: `pk_live_...` and `sk_live_...`
3. Create live webhook endpoint (same URL, live mode)
4. Store live secrets in Google Secret Manager for your production project
5. Test thoroughly in test environment before going live!

## Stripe Customer Portal

Users can manage their subscription via Stripe's hosted Customer Portal:
- View and download invoices
- Update payment methods
- Cancel subscriptions
- See billing history

Access via the "Manage Billing" button on the Settings page.

## Troubleshooting

### Webhooks Not Working in Local Dev

**Problem:** Subscriptions are created but user quota doesn't update.

**Solution:**
1. Check Terminal 2 - is `stripe listen` running?
2. Verify webhook secret in `.env.local` matches the one from `stripe listen`
3. Restart dev server after changing `.env.local`
4. Check for errors in Terminal 1 (Next.js console)

### Webhook Signature Verification Failed

**Problem:** Error: "No signatures found matching the expected signature for payload"

**Causes:**
1. Wrong webhook secret in environment variables
2. Using test webhook secret with live mode keys (or vice versa)
3. Webhook secret from Dashboard instead of `stripe listen` (for localhost)

**Solution:**
- **Localhost:** Always use the secret from `stripe listen` output
- **Test/Prod:** Use the secret from Stripe Dashboard webhook settings

### Can't Find Price IDs

**Problem:** "Price not found" error when creating checkout session.

**Solution:**
1. Go to Stripe Dashboard > Products
2. Find your product (e.g., "Starter Plan")
3. Copy the Price ID (starts with `price_`)
4. Update `.env.local` or Google Secret Manager

### Multiple Stripe Webhook Events

**Problem:** Seeing multiple subscription update events for one action.

**This is normal!** Stripe sends multiple events:
- `checkout.session.completed` - Checkout finished
- `customer.subscription.created` - Subscription created (not handled)
- `customer.subscription.updated` - Subscription activated
- `invoice.payment_succeeded` - First payment

Our webhook handler is idempotent and handles this correctly.

## Webhook Events Reference

### Events We Handle

| Event | Purpose |
|-------|---------|
| `checkout.session.completed` | New subscription created, initialize user quota |
| `customer.subscription.updated` | Subscription changed (renewal, plan change, cancellation) |
| `customer.subscription.deleted` | Subscription ended, revert to free tier |
| `invoice.payment_failed` | Payment failed, mark subscription as past_due |

### Events We Don't Handle

- `customer.subscription.created` - Too early, not needed
- `invoice.payment_succeeded` - Covered by subscription.updated
- `invoice.paid` - Duplicate of payment_succeeded
- `customer.updated` - Not needed for our use case

## Testing Checklist

Use this checklist to test the full subscription flow:

### New Subscription
- [ ] Click "Subscribe" on pricing page
- [ ] Complete checkout with test card `4242 4242 4242 4242`
- [ ] Verify redirect to dashboard/settings
- [ ] Check quota is updated (15/60/150 based on tier)
- [ ] Verify webhook events in Terminal 2 (localhost) or Stripe Dashboard

### Plan Change
- [ ] Go to Pricing page while subscribed
- [ ] Select different tier (upgrade or downgrade)
- [ ] Verify immediate tier change
- [ ] Check quota is updated
- [ ] Verify prorated invoice in Stripe Dashboard

### Cancellation
- [ ] Go to Settings page
- [ ] Click "Cancel Subscription"
- [ ] Confirm cancellation
- [ ] Verify "Canceled (active until [date])" status
- [ ] Verify quota still works until period end

### Reactivation
- [ ] After canceling, click "Reactivate Subscription"
- [ ] Confirm reactivation
- [ ] Verify "Active" status returned
- [ ] Verify renewal date restored

### Payment Method Update
- [ ] Go to Settings page
- [ ] Click "Manage Billing" (opens Stripe Customer Portal)
- [ ] Update payment method
- [ ] Verify new payment method shown in settings

### Invoice Access
- [ ] Click "Manage Billing" in Settings
- [ ] Navigate to "Invoices" tab
- [ ] Verify past invoices are visible
- [ ] Test download invoice PDF

### Payment Failure
- [ ] In Stripe Dashboard, mark subscription's next payment as failed
- [ ] Verify webhook handler sets status to "past_due"
- [ ] Verify user sees payment failure message

## Useful Commands

### Stripe CLI Commands

```bash
# Listen to all webhook events
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Listen to specific events only
stripe listen --events checkout.session.completed,customer.subscription.updated --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed

# View recent events
stripe events list --limit 10

# View specific event details
stripe events retrieve evt_123...

# List all products and prices
stripe products list
stripe prices list
```

### Firebase Commands

```bash
# View secrets
gcloud secrets list --project=echoscribe-test

# Access secret value
gcloud secrets versions access latest --secret=STRIPE_WEBHOOK_SECRET --project=echoscribe-test

# Deploy functions
firebase deploy --only functions --project=echoscribe-test
```

## Security Notes

1. **Never commit secrets to Git**
   - `.env.local` is in `.gitignore`
   - Use Google Secret Manager for test/prod

2. **Use test mode for development**
   - Test keys start with `sk_test_` and `pk_test_`
   - Never use live keys in development

3. **Verify webhook signatures**
   - Our code verifies all webhook signatures
   - Never disable signature verification

4. **Rate limiting removed**
   - Previously had in-memory rate limiting (doesn't work with multiple instances)
   - Stripe has built-in rate limiting
   - Idempotency keys prevent duplicate operations

## Support

- **Stripe Documentation:** https://stripe.com/docs
- **Stripe Testing:** https://stripe.com/docs/testing
- **Stripe CLI:** https://stripe.com/docs/stripe-cli
- **Firebase Secrets:** https://firebase.google.com/docs/functions/config-env
