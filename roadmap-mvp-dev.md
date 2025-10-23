# EchoScribe - MVP Development Roadmap

**Last Updated:** 2025-10-23
**Status:** In Development
**Target:** Complete MVP in DEV → Deploy to TEST

---

## Table of Contents

1. [Current Status](#current-status)
2. [GOAL 1: Complete MVP in DEV](#goal-1-complete-mvp-in-dev)
3. [GOAL 2: Deploy to Firebase Test Environment](#goal-2-deploy-to-firebase-test-environment)
4. [Timeline & Estimates](#timeline--estimates)
5. [Priority Order](#priority-order)
6. [Required Tools & Resources](#required-tools--resources)
7. [Technical Architecture Notes](#technical-architecture-notes)

---

## Current Status

### ✅ Working Features

- **Authentication**
  - User registration with email/password
  - Login and logout
  - Password reset flow
  - Auth context provider

- **Podcast Processing**
  - File upload with drag-and-drop (up to 500MB)
  - Supported formats: MP3, WAV, M4A, OGG
  - Cloud Tasks integration for async processing
  - Gemini AI 2.0 Flash integration
  - Automatic article generation

- **Article Management**
  - Article viewing
  - Export to Markdown
  - Export to HTML
  - SEO metadata (title, slug, description, keywords)
  - Schema.org markup
  - OpenGraph tags

- **Dashboard**
  - User statistics
  - Quota tracking (3/month free tier)
  - Podcast list with status
  - Article list

- **Security**
  - Firestore security rules
  - Storage security rules
  - Client-side auth protection
  - firebase-admin in Cloud Functions

- **Legal Pages**
  - Privacy policy ([app/privacy/page.tsx](app/privacy/page.tsx))
  - Terms of service ([app/terms/page.tsx](app/terms/page.tsx))
  - Imprint page ([app/imprint/page.tsx](app/imprint/page.tsx))

### 🚧 Partially Implemented

- **Settings Page** ([app/dashboard/settings/page.tsx](app/dashboard/settings/page.tsx))
  - Shows account info
  - Upgrade button (disabled)
  - Delete account button (disabled)

- **Middleware** ([middleware.ts](middleware.ts))
  - Currently has TODO for server-side auth
  - Only client-side protection active

### ❌ Missing for MVP

- Server-side auth verification
- Stripe payment integration
- Account deletion feature
- Error boundaries
- Full testing suite

---

## GOAL 1: Complete MVP in DEV

**Environment:** Firebase Emulators + Stripe Test Mode
**Estimated Time:** 6-8 days

### Task 1: Server-Side Auth Protection

**Objective:** Implement full token verification using firebase-admin

**Subtasks:**

1. **Initialize firebase-admin in Next.js**
   - Create `lib/firebase/admin.ts`
   - Initialize admin SDK
   - Configure for emulator mode in DEV
   - Handle TEST/PROD configuration

2. **Create Verify Token API Route**
   - File: `app/api/auth/verify-token/route.ts`
   - Use firebase-admin to verify ID tokens
   - Return validation status

3. **Update Login Flow**
   - Store Firebase ID token in httpOnly cookie
   - Update [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx)
   - Set secure cookie flags

4. **Update Middleware**
   - File: [middleware.ts](middleware.ts)
   - Extract token from cookies
   - Call verify-token API route
   - Redirect to `/login` if invalid
   - Allow access if valid

5. **Testing**
   - Test with valid token
   - Test with missing token
   - Test with expired token
   - Test with invalid token
   - Verify works with Auth Emulator

**Time Estimate:** 1 day

---

### Task 2: Stripe Payment Integration

**Objective:** Full payment flow with checkout, webhooks, and quota management

#### 2.1 Setup & Configuration

**Subtasks:**

1. **Get Stripe Test Keys**
   - Create Stripe account (or use existing)
   - Get test mode API keys
   - Update [.env.local](.env.local):
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
     - `STRIPE_SECRET_KEY`
     - `STRIPE_WEBHOOK_SECRET` (from Stripe CLI)

2. **Install Stripe CLI**
   ```bash
   # Install from: https://stripe.com/docs/stripe-cli
   stripe login
   ```

3. **Define Pricing**
   - Create Stripe products and prices in test mode
   - **Free Tier:** 3 podcasts/month (no Stripe product needed)
   - **Pro Tier:** Unlimited or 100 podcasts/month
   - Example: €19.99/month

**Time Estimate:** 0.5 day

#### 2.2 API Routes

**Subtasks:**

1. **Create Checkout Session Endpoint**
   - File: `app/api/stripe/create-checkout-session/route.ts`
   - Create Stripe Checkout Session
   - Set success/cancel URLs
   - Include metadata (userId)
   - Return checkout URL

2. **Create Webhook Handler**
   - File: `app/api/webhooks/stripe/route.ts`
   - Verify webhook signature
   - Handle events:
     - `checkout.session.completed` - Create subscription in Firestore
     - `customer.subscription.updated` - Update subscription status
     - `customer.subscription.deleted` - Mark as canceled
   - Update Firestore `subscriptions` collection
   - Use firebase-admin for privileged writes

3. **Create Customer Portal Session**
   - File: `app/api/stripe/create-portal-session/route.ts`
   - Generate Customer Portal link
   - Allow users to manage/cancel subscription

**Time Estimate:** 1.5 days

#### 2.3 Quota System Update

**Subtasks:**

1. **Update Quota Check Logic**
   - File: [lib/firebase/users.ts](lib/firebase/users.ts)
   - Check subscription status from Firestore
   - Logic:
     ```
     if user has active subscription:
       quota = unlimited (or 100/month)
     else:
       quota = 3/month
     ```

2. **Update Firestore Rules**
   - File: [firestore.rules](firestore.rules)
   - Add subscription collection rules
   - Only user can read own subscription
   - Only Cloud Functions/webhooks can write

**Time Estimate:** 0.5 day

#### 2.4 Settings UI

**Subtasks:**

1. **Update Settings Page**
   - File: [app/dashboard/settings/page.tsx](app/dashboard/settings/page.tsx)
   - Enable "Upgrade" button
   - Fetch subscription status from Firestore
   - Display:
     - Current plan (Free/Pro)
     - Billing period end (if Pro)
     - Quota limit
   - Add "Manage Subscription" button (opens Customer Portal)

2. **Success/Cancel Pages**
   - File: `app/stripe/success/page.tsx` - Payment success
   - File: `app/stripe/cancel/page.tsx` - Payment canceled

**Time Estimate:** 0.5 day

#### 2.5 Testing with Stripe CLI

**Subtasks:**

1. **Start Stripe Webhook Forwarding**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   - Copy webhook secret to `.env.local`

2. **Test Checkout Flow**
   - Click "Upgrade" button
   - Use test card: `4242 4242 4242 4242`
   - Verify redirect to success page
   - Check webhook received
   - Verify subscription created in Firestore
   - Verify quota updated

3. **Test Customer Portal**
   - Click "Manage Subscription"
   - Cancel subscription
   - Verify webhook received
   - Verify status updated to "canceled"
   - Verify quota reverted to free tier

4. **Test Payment Failures**
   - Use decline card: `4000 0000 0000 0002`
   - Verify error handling

**Time Estimate:** 1 day

**Total Stripe Integration Time:** 2-3 days

---

### Task 3: Account Deletion Feature

**Objective:** Allow users to permanently delete their account and all data

**Subtasks:**

1. **Create Cloud Function**
   - File: `functions/src/callable/deleteUserAccount.ts`
   - Callable function (requires auth)
   - Steps:
     1. Verify user is deleting own account
     2. Cancel Stripe subscription (if exists)
     3. Delete all podcasts from Firestore
     4. Delete all articles from Firestore
     5. Delete all files from Storage (podcasts/{userId}/*)
     6. Delete user document from Firestore
     7. Delete Firebase Auth account
   - Use firebase-admin for privileged operations
   - Add error handling and logging

2. **Update Settings Page**
   - File: [app/dashboard/settings/page.tsx](app/dashboard/settings/page.tsx)
   - Enable "Delete Account" button
   - Add confirmation dialog:
     - Warn about permanent deletion
     - Require typing "DELETE" or email to confirm
   - Call Cloud Function
   - Sign out and redirect to homepage on success

3. **Testing**
   - Test with free account
   - Test with active subscription (verify Stripe cancellation)
   - Test with uploaded podcasts (verify Storage cleanup)
   - Verify Auth account deleted
   - Verify all Firestore data removed

**Time Estimate:** 1 day

---

### Task 4: Error Boundaries

**Objective:** Catch React errors and show user-friendly fallback UI

**Subtasks:**

1. **Create Error Boundary Component**
   - File: `components/error-boundary.tsx`
   - Catch React errors
   - Display German error message
   - Provide "Try Again" button
   - Log error to console (or error tracking service later)

2. **Wrap Dashboard Layout**
   - File: `app/dashboard/layout.tsx`
   - Wrap children with error boundary

3. **Create Error Pages**
   - File: `app/error.tsx` - Global error handler
   - File: `app/dashboard/error.tsx` - Dashboard error handler

4. **Testing**
   - Trigger intentional error
   - Verify error boundary catches it
   - Verify user sees friendly message

**Time Estimate:** 0.5 day

---

### Task 5: UX Polish

**Objective:** Improve user experience with better feedback and confirmations

**Subtasks:**

1. **Confirmation Dialogs**
   - Delete account confirmation (already in Task 3)
   - Delete article confirmation
   - Delete podcast confirmation
   - Create reusable dialog component

2. **Error Messages**
   - Review all error messages
   - Ensure all are in German
   - Make user-friendly (avoid technical jargon)
   - Examples:
     - ❌ "Firebase Auth Error: auth/invalid-credential"
     - ✅ "E-Mail oder Passwort falsch. Bitte versuchen Sie es erneut."

3. **Loading States**
   - Ensure all buttons show loading during async operations
   - Add skeleton loaders for lists
   - Add progress indicators for file uploads

4. **Success Messages**
   - Toast on successful subscription
   - Toast on successful article export
   - Toast on successful podcast upload

**Time Estimate:** 1 day

---

### Task 6: Testing in DEV

**Objective:** Comprehensive testing of all features in emulator environment

**Testing Checklist:**

#### Auth Flow
- [ ] Register new account
- [ ] Login with correct credentials
- [ ] Login with wrong credentials (verify error)
- [ ] Password reset flow
- [ ] Logout
- [ ] Try accessing `/dashboard` without login (should redirect)
- [ ] Access `/dashboard` with valid token (should allow)

#### Podcast Upload & Processing
- [ ] Upload valid MP3 file
- [ ] Upload 500MB file (at limit)
- [ ] Try upload >500MB (should fail)
- [ ] Try upload invalid file type (should fail)
- [ ] Verify processing starts
- [ ] Verify status updates in real-time
- [ ] Verify article generated correctly
- [ ] Check Gemini API was called
- [ ] Test Cloud Task retry on failure

#### Article Management
- [ ] View generated article
- [ ] Export to Markdown
- [ ] Export to HTML
- [ ] Verify SEO metadata correct
- [ ] Delete article

#### Quota System
- [ ] Upload 3 podcasts (free tier)
- [ ] Try 4th upload (should fail with quota error)
- [ ] Upgrade to Pro
- [ ] Upload 4th podcast (should succeed)
- [ ] Cancel subscription
- [ ] Verify quota reverts to 3/month

#### Stripe Integration
- [ ] Click "Upgrade" button
- [ ] Complete checkout with test card
- [ ] Verify webhook received (check Stripe CLI output)
- [ ] Verify subscription created in Firestore
- [ ] Verify subscription shown in Settings
- [ ] Open Customer Portal
- [ ] Cancel subscription
- [ ] Verify cancellation webhook received
- [ ] Verify status updated in Firestore
- [ ] Test payment failure scenario

#### Account Deletion
- [ ] Delete account with no data
- [ ] Delete account with podcasts (verify Storage cleanup)
- [ ] Delete account with active subscription (verify Stripe cancellation)
- [ ] Verify all Firestore data deleted
- [ ] Verify Auth account deleted
- [ ] Verify cannot login with deleted account

#### Error Handling
- [ ] Trigger error in component (verify error boundary)
- [ ] Test invalid token (verify middleware redirects)
- [ ] Test network error during upload
- [ ] Test webhook signature verification failure

**Time Estimate:** 1-2 days

**Total GOAL 1 Time:** 6-8 days

---

## GOAL 2: Deploy to Firebase Test Environment

**Environment:** Firebase Test Project + Stripe Test Mode
**Estimated Time:** 2-3 days

### Task 7: Firebase Test Project Setup

**Subtasks:**

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create new project: "echoscribe-test"
   - Enable Google Analytics (optional)

2. **Enable Services**
   - Authentication (Email/Password provider)
   - Firestore Database
   - Storage
   - Functions
   - Cloud Tasks (via GCP Console)

3. **Configure Cloud Tasks**
   - Go to [GCP Cloud Tasks](https://console.cloud.google.com/cloudtasks)
   - Create queue: `podcast-processing`
   - Region: `europe-west1`
   - Rate limits: 3 concurrent tasks

4. **Set Up Firebase Secrets**
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY --project echoscribe-test
   firebase functions:secrets:set STRIPE_SECRET_KEY --project echoscribe-test
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project echoscribe-test
   ```

5. **Get Firebase Config**
   - Project settings → Your apps → Web app
   - Copy config for `.env.test`

**Time Estimate:** 0.5 day

---

### Task 8: Stripe Test Environment

**Subtasks:**

1. **Configure Webhook Endpoint**
   - Wait until Next.js app deployed (Task 10)
   - Go to [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
   - Add endpoint: `https://your-test-domain.com/api/webhooks/stripe`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy webhook secret

2. **Update Webhook Secret**
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project echoscribe-test
   ```
   Or update Next.js environment variables

3. **Test Webhook Delivery**
   - Stripe Dashboard → Webhooks → Send test webhook
   - Verify received in application logs

**Time Estimate:** 0.5 day

---

### Task 9: Configuration Files

**Subtasks:**

1. **Create `.env.test`**
   ```env
   # Firebase Test Project
   NEXT_PUBLIC_FIREBASE_API_KEY=your-test-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=echoscribe-test.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=echoscribe-test
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=echoscribe-test.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

   # Disable emulator for TEST
   NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false

   # Gemini API (use Secret Manager in functions)
   GEMINI_API_KEY=will-use-secret-manager

   # Stripe Test Mode
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-key
   STRIPE_SECRET_KEY=sk_test_your-key (use Secret Manager)
   STRIPE_WEBHOOK_SECRET=whsec_your-secret (use Secret Manager)
   ```

2. **Update `.firebaserc`**
   ```json
   {
     "projects": {
       "default": "demo-echoscribe",
       "test": "echoscribe-test"
     }
   }
   ```

3. **Deploy Firestore Rules**
   ```bash
   firebase deploy --only firestore:rules --project test
   ```

4. **Deploy Storage Rules**
   ```bash
   firebase deploy --only storage --project test
   ```

5. **Deploy Firestore Indexes**
   - File: [firestore.indexes.json](firestore.indexes.json)
   - Add any needed indexes
   ```bash
   firebase deploy --only firestore:indexes --project test
   ```

**Time Estimate:** 0.5 day

---

### Task 10: Deploy & Verify

**Subtasks:**

1. **Deploy Cloud Functions**
   ```bash
   cd functions
   npm run build
   firebase deploy --only functions --project test
   ```
   - Verify secrets are accessible
   - Check logs for errors

2. **Deploy Next.js App**

   **Option A: Firebase Hosting**
   ```bash
   npm run build
   firebase deploy --only hosting --project test
   ```

   **Option B: Vercel**
   - Connect GitHub repo to Vercel
   - Configure environment variables
   - Deploy

3. **Configure firebase-admin for TEST**
   - If using Vercel: Upload service account JSON as environment variable
   - If using Firebase Hosting: Use Workload Identity (automatic)

4. **Smoke Tests**
   - [ ] Register new account
   - [ ] Upload podcast
   - [ ] Verify Cloud Function triggers
   - [ ] Verify article generated
   - [ ] Test Stripe checkout
   - [ ] Verify webhook received
   - [ ] Test Customer Portal
   - [ ] Delete account

5. **Monitor Logs**
   - Cloud Functions logs: [Firebase Console](https://console.firebase.google.com/)
   - Next.js logs: Vercel Dashboard or Firebase Hosting logs
   - Stripe webhook logs: [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)

6. **Performance Check**
   - Test upload speed
   - Test processing time
   - Check Firestore read/write counts
   - Monitor Cloud Functions cold starts

**Time Estimate:** 1 day

---

### Task 11: Documentation

**Objective:** Document deployment and setup processes

**Subtasks:**

1. **Update README.md**
   - Add TEST deployment instructions
   - Add environment setup guide
   - Add troubleshooting section

2. **Create Deployment Guide**
   - File: `docs/deployment.md`
   - DEV setup (emulators)
   - TEST deployment
   - PROD deployment (placeholder)

3. **Environment Variables Reference**
   - File: `docs/environment-variables.md`
   - List all env vars
   - Explain each one
   - Show where to get values

4. **Stripe Setup Guide**
   - File: `docs/stripe-setup.md`
   - How to get API keys
   - How to set up products
   - How to configure webhooks
   - How to use Stripe CLI for DEV

5. **firebase-admin Setup**
   - File: `docs/firebase-admin-setup.md`
   - DEV configuration (emulators)
   - TEST configuration (service account)
   - PROD configuration (Workload Identity)

6. **Troubleshooting Guide**
   - File: `docs/troubleshooting.md`
   - Common errors and solutions
   - Emulator issues
   - Deployment issues
   - Stripe webhook issues

**Time Estimate:** 0.5 day

**Total GOAL 2 Time:** 2-3 days

---

## Timeline & Estimates

### Overall Timeline

| Phase | Tasks | Duration | Cumulative |
|-------|-------|----------|------------|
| **GOAL 1: MVP in DEV** | Tasks 1-6 | 6-8 days | 6-8 days |
| **GOAL 2: Deploy to TEST** | Tasks 7-11 | 2-3 days | 8-11 days |
| **Total** | All tasks | **8-11 days** | - |

### Detailed Breakdown

| Task | Description | Time |
|------|-------------|------|
| 1 | Server-side auth protection | 1 day |
| 2.1 | Stripe setup & configuration | 0.5 day |
| 2.2 | Stripe API routes | 1.5 days |
| 2.3 | Quota system update | 0.5 day |
| 2.4 | Settings UI | 0.5 day |
| 2.5 | Stripe testing | 1 day |
| 3 | Account deletion | 1 day |
| 4 | Error boundaries | 0.5 day |
| 5 | UX polish | 1 day |
| 6 | Testing in DEV | 1-2 days |
| 7 | Firebase test project setup | 0.5 day |
| 8 | Stripe test environment | 0.5 day |
| 9 | Configuration files | 0.5 day |
| 10 | Deploy & verify | 1 day |
| 11 | Documentation | 0.5 day |

### Assumptions

- Working 6-8 hours per day
- No major blockers
- Familiar with Firebase and Stripe basics
- Gemini API access confirmed
- Stripe account ready

---

## Priority Order

Work on tasks in this order for optimal flow:

### Week 1: Core Features (Days 1-5)

1. **Server-Side Auth** (Day 1)
   - Most foundational feature
   - Needed before testing anything securely

2. **Stripe Integration** (Days 2-4)
   - Core monetization feature
   - Most complex, needs time for testing
   - Order within Stripe:
     1. Setup & configuration
     2. Checkout session API
     3. Webhook handler
     4. Quota system integration
     5. Settings UI
     6. Testing with Stripe CLI

3. **Account Deletion** (Day 5)
   - Depends on Stripe (must cancel subscriptions)
   - Requires auth to be working

### Week 2: Polish & Deploy (Days 6-11)

4. **Error Boundaries** (Day 6)
   - Quick win
   - Improves stability before testing

5. **UX Polish** (Day 7)
   - Better experience during testing
   - Confirmation dialogs needed for testing

6. **Comprehensive Testing** (Days 8-9)
   - Test everything in DEV
   - Fix any bugs found

7. **Firebase Test Setup** (Day 9)
   - Can start while testing
   - Create project, enable services

8. **Deploy to TEST** (Day 10)
   - Deploy all components
   - Run smoke tests

9. **Documentation** (Day 11)
   - Final step
   - Document everything while fresh

---

## Required Tools & Resources

### Development Tools

1. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Stripe CLI**
   - Download: [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
   - Login: `stripe login`
   - Forward webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

3. **Node.js 20+**
   - Already installed
   - Matches Cloud Functions runtime

### API Keys & Credentials

1. **Gemini API Key**
   - Get from: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - Already have in `.env.local`
   - Will move to Secret Manager for TEST

2. **Stripe Test Keys**
   - Dashboard: [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
   - Publishable key: `pk_test_...`
   - Secret key: `sk_test_...`

3. **Firebase Config**
   - DEV: Already in `.env.local`
   - TEST: Get from Firebase Console after creating project

### Stripe Test Cards

**Success:**
- `4242 4242 4242 4242` - Visa (any CVC, future expiry)

**Decline:**
- `4000 0000 0000 0002` - Card declined

**3D Secure:**
- `4000 0027 6000 3184` - Requires authentication

**More:** [https://stripe.com/docs/testing](https://stripe.com/docs/testing)

### Running Emulators

```bash
# Terminal 1: Firebase Emulators
npm run emulators

# Terminal 2: Next.js Dev Server
npm run dev

# Terminal 3: Stripe CLI (for webhooks)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Emulator URLs:**
- Next.js: http://localhost:3000
- Firebase UI: http://localhost:4000
- Firestore: http://localhost:8080
- Auth: http://localhost:9099
- Functions: http://localhost:5001
- Storage: http://localhost:9199

---

## Technical Architecture Notes

### firebase-admin Usage

**Two Separate Environments:**

1. **Cloud Functions** (already implemented)
   - File: `functions/src/index.ts`
   - Used for: Podcast processing, privileged Firestore writes
   - Initialized once in Cloud Functions

2. **Next.js API Routes** (to be implemented)
   - File: `lib/firebase/admin.ts`
   - Used for: Token verification, account deletion
   - Separate initialization from Cloud Functions

**DEV Mode:**
- Both point to emulators
- Use demo project ID

**TEST/PROD Mode:**
- Both use real Firebase
- Next.js: Service account JSON or Workload Identity
- Cloud Functions: Automatic authentication

### Stripe Webhook Security

**Signature Verification:**
```typescript
const sig = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
```

**Why it matters:**
- Prevents unauthorized requests
- Ensures webhook came from Stripe
- Protects against replay attacks

**DEV:** Webhook secret from Stripe CLI
**TEST/PROD:** Webhook secret from Stripe Dashboard

### Quota System Logic

**Free Tier:**
```typescript
user.quotaUsed < 3 && user.subscriptionStatus !== 'active'
```

**Pro Tier:**
```typescript
user.subscriptionStatus === 'active'
  ? 100 // or unlimited
  : 3
```

**Monthly Reset:**
- Cloud Scheduler (to be implemented)
- Runs on 1st of each month
- Resets `quotaUsed` to 0 for all users

### Error Handling Strategy

**Client-Side:**
- Error boundaries for React errors
- Toast notifications for user-facing errors
- Loading states during async operations

**Server-Side:**
- Try-catch blocks in API routes
- Structured logging in Cloud Functions
- Webhook retry logic (automatic in Stripe)
- Cloud Tasks retry logic (configured)

### Security Considerations

1. **Token Storage**
   - httpOnly cookies (prevents XSS)
   - Secure flag in production
   - SameSite=Lax or Strict

2. **Firestore Rules**
   - User data isolated by UID
   - Subscriptions only readable by owner
   - Only functions can write to subscriptions

3. **Stripe Webhooks**
   - Signature verification mandatory
   - No processing without valid signature

4. **API Routes**
   - All protected by auth middleware
   - Rate limiting (to be added in PROD)

---

## Success Criteria

### GOAL 1 Complete When:
- ✅ Auth middleware verifies tokens server-side
- ✅ User can upgrade to Pro via Stripe
- ✅ Quota increases after subscription
- ✅ User can manage subscription via Customer Portal
- ✅ User can delete account (including Stripe cleanup)
- ✅ Error boundaries catch component crashes
- ✅ All features tested in DEV with emulators
- ✅ All tests pass

### GOAL 2 Complete When:
- ✅ Firebase test project created and configured
- ✅ Cloud Functions deployed to TEST
- ✅ Next.js app deployed to TEST
- ✅ Stripe webhooks working in TEST
- ✅ All smoke tests pass
- ✅ Documentation complete

### Ready for PROD When:
- ✅ All features work in TEST
- ✅ Load testing complete
- ✅ Security audit done
- ✅ Legal pages finalized
- ✅ Monitoring/alerting set up
- ✅ Backup strategy in place

---

## Notes & Reminders

### Important Files

**Key Configuration:**
- [.env.local](.env.local) - DEV environment variables
- [.firebaserc](.firebaserc) - Firebase project aliases
- [firebase.json](firebase.json) - Firebase configuration
- [firestore.rules](firestore.rules) - Database security
- [storage.rules](storage.rules) - Storage security

**Auth:**
- [middleware.ts](middleware.ts) - Route protection
- [lib/firebase/auth-context.tsx](lib/firebase/auth-context.tsx) - Auth provider

**Stripe Types:**
- [types/subscription.ts](types/subscription.ts) - Subscription types
- [types/user.ts](types/user.ts) - User types

**Cloud Functions:**
- [functions/src/triggers/onPodcastUploaded.ts](functions/src/triggers/onPodcastUploaded.ts) - Main trigger
- [functions/src/services/gemini.ts](functions/src/services/gemini.ts) - AI integration

### Known Issues

1. **Middleware TODO** - [middleware.ts:6](middleware.ts#L6)
   - Currently only client-side auth
   - Will be fixed in Task 1

2. **Disabled Buttons** - [app/dashboard/settings/page.tsx](app/dashboard/settings/page.tsx)
   - Upgrade button disabled (will enable in Task 2)
   - Delete button disabled (will enable in Task 3)

3. **Empty Indexes** - [firestore.indexes.json](firestore.indexes.json)
   - May need indexes for queries
   - Add during testing if needed

### Future Enhancements (Post-MVP)

- Multiple pricing tiers (Basic, Pro, Enterprise)
- Usage-based billing
- Email notifications
- Article editing
- Analytics dashboard
- API for partners
- Mobile app
- Team collaboration features

---

## Contact & Support

**Developer:** Your Name
**Project:** EchoScribe
**Repository:** (add GitHub URL if applicable)
**Firebase Project (DEV):** demo-echoscribe
**Firebase Project (TEST):** echoscribe-test (to be created)

---

**Last Updated:** 2025-10-23
**Next Review:** After completing GOAL 1
