# EchoScribe - Cloud Functions Architecture

## Overview

**Current Architecture:** HTTP Function-based Processing (No Cloud Tasks)

All Cloud Functions use automatic region configuration based on environment:
- **TEST** (`echoscribe-test`): `europe-west1` (Multi-Region EU)
- **PROD** (`echoscribe-prod`): `europe-west3` (Deutschland)
- **Service Accounts:**
  - TEST: `436441931185-compute@developer.gserviceaccount.com`
  - PROD: `673230184143-compute@developer.gserviceaccount.com`

### Architecture Change (November 2024)

**Old Architecture (Deprecated):**
- ❌ Cloud Tasks queue for job management
- ❌ Separate task handler function
- ❌ Complex queue configuration
- ❌ Potential zombie task issues

**New Architecture (Current):**
- ✅ Direct HTTP function invocation
- ✅ Service-to-service authentication
- ✅ Zombie prevention built-in
- ✅ Simpler deployment and maintenance
- ✅ Lower costs (no Cloud Tasks overhead)
- ✅ Atomic quota management with transactions

**Functions:**
1. `onPodcastUploaded` - Storage trigger (handles upload + quota)
2. `processPodcastHttp` - HTTP function (processes audio with Vertex AI)
3. `cleanupStuckPodcasts` - Scheduled maintenance

## Region Configuration

### Zentrale Region-Verwaltung

**Aktuelle Konfiguration** in `functions/src/config/regions.ts`:

| Environment | Cloud Functions | Firestore | Hosting | Pricing |
|-------------|----------------|-----------|---------|---------|
| **TEST** (`echoscribe-test`) | `europe-west1` (Belgien) | `eur3` (Multi-Region EU) | 🇪🇺 Multi-Region EU | Tier 1 (günstiger) |
| **PROD** (`echoscribe-prod`) | `europe-west3` (Frankfurt) | `europe-west3` (Frankfurt) | 🇩🇪 Deutschland | Tier 2 (+20%) |

### Automatische Environment-Erkennung

Die Config erkennt automatisch, ob du in TEST oder PROD bist:

```typescript
// Deployed in echoscribe-test:
config.region = "europe-west1"  // Multi-Region EU
config.functions.processPodcastTask.uri =
  "https://europe-west1-echoscribe-test.cloudfunctions.net/processPodcastTask"

// Deployed in echoscribe-prod:
config.region = "europe-west3"  // Deutschland
config.functions.processPodcastTask.uri =
  "https://europe-west3-echoscribe-prod.cloudfunctions.net/processPodcastTask"
```

**Kein manueller Eingriff nötig!** Die Region wechselt automatisch beim Deploy zu prod.

### Region ändern (falls nötig)

Öffne `functions/src/config/regions.ts` und ändere:

```typescript
export const REGIONS = {
  development: "europe-west1",  // TEST
  production: "europe-west3",   // PROD ← Hier ändern
}
```

**Verfügbare Regionen:**
- `europe-west1` (Belgien) - Tier 1, Multi-Region EU
- `europe-west3` (Frankfurt, Deutschland) - Tier 2, Deutschland-Only
- `europe-west2` (London, UK) - Tier 1
- Weitere: https://firebase.google.com/docs/functions/locations

### Firestore Region für PROD

**WICHTIG:** Firestore Region wird beim **ersten Erstellen** der Datenbank festgelegt.

**Für Deutschland-Hosting in PROD:**

```bash
# BEVOR du erste Daten schreibst:
firebase use prod
gcloud firestore databases create --database="(default)" \
  --location=europe-west3 \
  --project=echoscribe-prod
```

**Optionen:**
- `europe-west3` (Frankfurt, Single-Region) - Empfohlen für PROD (Deutschland-Only)
- `eur3` (Multi-Region) - Falls du doch Multi-Region willst

**⚠️ Kann später NICHT geändert werden!**

### Hosting-Übersicht

#### TEST System (echoscribe-test)
- ✅ Cloud Functions: `europe-west1` (Belgien, EU)
- ✅ Firestore: `eur3` (Multi-Region: Deutschland, Belgien, Niederlande)
- ✅ Storage: `eur3` (Multi-Region EU)
- ✅ Kosten: Tier 1 Pricing
- ✅ DSGVO: Konform (EU)

#### PROD System (echoscribe-prod)
- ✅ Cloud Functions: `europe-west3` (Frankfurt, Deutschland)
- ✅ Firestore: `europe-west3` (Frankfurt, Deutschland) - Beim Setup anlegen!
- ✅ Storage: `europe-west3` (Frankfurt, Deutschland)
- ✅ Kosten: Tier 2 Pricing (~20% höher)
- ✅ DSGVO: Konform (Deutschland)
- ✅ Marketing: "100% Made in Germany" 🇩🇪

### Deployment Workflow

**TEST Deploy:**
```bash
firebase use test
firebase deploy --only functions
# ✅ Automatisch in europe-west1 (Belgien, Multi-Region EU)
```

**PROD Deploy:**
```bash
firebase use prod
firebase deploy --only functions
# ✅ Automatisch in europe-west3 (Frankfurt, Deutschland) 🇩🇪
```

**Region prüfen:**
```bash
gcloud run services list --project=echoscribe-prod \
  --format="table(metadata.name,metadata.labels.goog-drz-cloudfunctions-location)"
```

### Vorteile der automatischen Config

1. ✅ **Keine Code-Änderungen** beim Wechsel TEST ↔ PROD
2. ✅ **Eine zentrale Stelle** zum Ändern der Region
3. ✅ **Automatische URI-Generierung** für Queue Path und Function URL
4. ✅ **Type-Safe** mit TypeScript
5. ✅ **Logging** zeigt aktuelle Environment-Info
6. ✅ **Fehler-Prävention** - keine hardcoded URLs mehr

### Kosten-Unterschied

**Beispiel-Rechnung** (1 Million Function Invocations):

| | TEST (Tier 1) | PROD (Tier 2) | Differenz |
|---|--------------|---------------|-----------|
| Invocations | $0.40 | $0.48 | +$0.08 |
| Compute (GB-sec) | $0.0000025/GB-sec | $0.0000030/GB-sec | +20% |
| Network Egress | Standard | Standard | Gleich |

**Fazit:** ~20% höhere Kosten für Cloud Functions in PROD (Deutschland), aber dafür 100% Deutschland-Hosting.

---

## Podcast Processing Flow (HTTP Function)

**Architecture:** Storage Trigger → HTTP Cloud Function → Vertex AI Processing

```
1. User uploads audio file
   ↓
2. onPodcastUploaded (Storage Trigger)
   - Validates audio duration server-side using music-metadata
   - Atomic quota reservation with transaction
   - Creates Firestore document (status: "queued")
   - Returns immediately (~1-2 seconds)
   ↓
3. Calls processPodcastHttp (HTTP Function)
   - Service-to-service authentication via Google Auth (ID token)
   - POST request with podcastId, storagePath, userId
   ↓
4. processPodcastHttp (Background Processing)
   - Zombie prevention: Checks if podcast still exists
   - Atomic status check (prevents duplicate processing)
   - Returns 202 Accepted immediately (storage trigger completes)
   - Continues processing in background
   - Downloads audio from Storage
   - Two-stage Vertex AI pipeline:
     * Stage 1: Audio → Teaser Article (500-1200 words)
     * Stage 2: Article → SEO + Social Media Metadata
   - Saves article to Firestore
   - Updates podcast status to "completed"
   - On error: Refunds quota automatically
```

**Key Benefits:**
- ✅ **No Zombie Tasks:** Deleted podcasts are detected before processing starts
- ✅ **Simpler Architecture:** Direct HTTP invocation, no persistent queue management
- ✅ **Automatic Retry:** Built-in HTTP retry on 500 errors
- ✅ **Lower Costs:** No Cloud Tasks quota or management overhead
- ✅ **Quota Safety:** Atomic reservation + automatic refund on errors
- ✅ **Race Condition Protection:** Transaction-based quota checks

## Key Implementation Details

### HTTP Function Invocation

**File:** `functions/src/triggers/onPodcastUploaded.ts`

```typescript
// Get the HTTP function URL from config (automatically adjusts for TEST/PROD)
const httpFunctionUrl = config.functions.processPodcastHttp.uri;
// TEST: https://europe-west1-echoscribe-test.cloudfunctions.net/processPodcastHttp
// PROD: https://europe-west3-echoscribe-prod.cloudfunctions.net/processPodcastHttp

// Get authenticated client for service-to-service communication
// This automatically generates an ID token with the correct audience
const client = await auth.getIdTokenClient(httpFunctionUrl);

// Make authenticated request to HTTP function
const response = await client.request({
  url: httpFunctionUrl,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  data: {
    podcastId,
    storagePath: filePath,
    userId,
  },
});
```

### Critical Requirements

1. ✅ **Service-to-Service Authentication**
   - Uses Google Auth Library (`GoogleAuth` from `google-auth-library`)
   - Automatically generates ID tokens for authenticated requests
   - No manual token management needed

2. ✅ **HTTP Function Configuration**
   - **Timeout:** 3600 seconds (60 minutes)
   - **Memory:** 4 GiB (handles large audio files up to 500 MB)
   - **CPU:** 2 vCPUs (faster processing)
   - **Max Instances:** 3 (limits concurrent processing)

3. ✅ **Atomic Status Updates**
   - Uses Firestore transactions to prevent race conditions
   - Checks if podcast is already processing or completed
   - Prevents duplicate processing of same podcast

4. ✅ **Immediate Response Pattern**
   - Returns 202 Accepted immediately after status update
   - Continues processing in background
   - Storage trigger completes quickly (~2-3 seconds)

5. ✅ **Zombie Prevention**
   - Checks if podcast document exists before processing
   - Returns 200 OK if podcast deleted (prevents retries)
   - Saves costs by not processing deleted uploads

## Function Configuration

### onPodcastUploaded (Storage Trigger)

**Type:** Storage Trigger (`onObjectFinalized`)
**Timeout:** Default (540 seconds)
**Memory:** 2 GiB (handles metadata extraction for large files)
**Trigger:** File upload to `podcasts/{userId}/{timestamp}_{duration}min_{filename}` path
**Region:** Automatic (TEST: europe-west1, PROD: europe-west3)

**Responsibilities:**
1. **Duration Validation:** Server-side validation using `music-metadata` library
   - Extracts actual audio duration from file metadata
   - Compares with client-reported duration
   - Logs warnings for >5% discrepancy, errors for >15%
2. **Atomic Quota Reservation:** Transaction-based quota check
   - Checks if user has sufficient quota
   - Reserves quota immediately (prevents race conditions)
   - Creates podcast document with "queued" status
   - If quota exceeded: Deletes file + creates "quota_exceeded" document
3. **Post-Transaction Verification:** Catches race conditions
   - Verifies quota still available after transaction
   - Rollbacks and refunds if quota exceeded by concurrent uploads
4. **HTTP Function Invocation:** Calls `processPodcastHttp` with authentication
   - Uses Google Auth for service-to-service communication
   - Returns immediately (fast response ~1-2 seconds)

**File:** `functions/src/triggers/onPodcastUploaded.ts`

### processPodcastHttp (HTTP Function)

**Type:** HTTP Cloud Function (`onRequest`)
**Timeout:** 3600 seconds (60 minutes, supports up to 4-hour podcasts)
**Memory:** 4 GiB (handles large audio files up to 500 MB)
**CPU:** 2 vCPUs (faster processing)
**Max Instances:** 3 (prevents overwhelming Vertex AI)
**Region:** Automatic (TEST: europe-west1, PROD: europe-west3)

**Responsibilities:**
1. **Zombie Prevention:** Checks if podcast document exists
2. **Atomic Status Check:** Transaction ensures not already processing/completed
3. **Immediate Response:** Returns 202 Accepted after status update
4. **Background Processing:**
   - Verifies audio file exists in Storage
   - Downloads audio file
   - Processes with Vertex AI (Two-Stage Pipeline):
     * Stage 1: Audio → Teaser Article (500-1200 words)
     * Stage 2: Article → SEO + Social Media Metadata
   - Saves article to Firestore
   - Updates podcast status to "completed"
5. **Error Handling:**
   - Refunds quota automatically on errors
   - Updates podcast status to "error"
   - Logs detailed error information

**File:** `functions/src/http/processPodcastHttp.ts`

**Error Handling:**
- Automatic HTTP retry on 500 errors (built-in)
- Quota refunded on all errors
- Detailed error logging with stack traces
- Podcast status updated to "error" with details

## Concurrency & Rate Limiting

**HTTP Function Configuration:**
- **Max Instances:** 3 (configured in `processPodcastHttp` options)
  - Prevents overwhelming Vertex AI
  - Limits concurrent audio processing
  - Prevents storage/memory issues from parallel downloads

**Benefits over Cloud Tasks:**
- ✅ Simpler configuration (no separate queue to manage)
- ✅ Built-in HTTP retry on transient errors
- ✅ No queue management costs
- ✅ Direct invocation reduces latency

## IAM Permissions Required

**Service Accounts:**
- **TEST:** `436441931185-compute@developer.gserviceaccount.com`
- **PROD:** `673230184143-compute@developer.gserviceaccount.com`

**Required Roles:**

| Role | Purpose |
|------|---------|
| `roles/datastore.user` | Read/write Firestore documents |
| `roles/storage.objectViewer` | Read audio files from Storage |
| `roles/aiplatform.user` | Access Vertex AI Gemini API |
| `roles/run.invoker` | Invoke HTTP Cloud Functions (service-to-service) |

**No Longer Required (removed Cloud Tasks):**
- ~~`roles/cloudtasks.enqueuer`~~ - No queue management needed
- ~~`roles/cloudtasks.taskRunner`~~ - No task execution needed

**Verify permissions:**
```bash
# TEST
gcloud projects get-iam-policy echoscribe-test \
  --flatten="bindings[].members" \
  --filter="bindings.members:436441931185-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"

# PROD
gcloud projects get-iam-policy echoscribe-prod \
  --flatten="bindings[].members" \
  --filter="bindings.members:673230184143-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

## Deployment

### Deploy all functions:
```bash
# TEST
firebase use test
firebase deploy --only functions

# PROD
firebase use prod
firebase deploy --only functions
```

### Deploy specific function:
```bash
# Deploy storage trigger
firebase deploy --only functions:onPodcastUploaded

# Deploy HTTP processor
firebase deploy --only functions:processPodcastHttp
```

### View logs:
```bash
# All functions (Firebase CLI)
firebase functions:log --project echoscribe-test

# Specific function logs (gcloud)
# Storage trigger
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=onPodcastUploaded" \
  --limit=50 \
  --project=echoscribe-test

# HTTP function (Cloud Run revision)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=processpodcasthttp" \
  --limit=50 \
  --format=json \
  --project=echoscribe-test
```

## Troubleshooting

### Common Issues & Solutions

#### Podcast stuck in "queued" status

**Symptom:** Podcast uploaded successfully, status shows "queued", but never progresses to "processing"

**Possible Causes:**
1. HTTP function not invoked (check storage trigger logs)
2. Authentication failure (service-to-service auth issue)
3. HTTP function invocation failed (check error logs)

**Solution:**
```bash
# Check storage trigger logs
gcloud logging read "resource.labels.function_name=onPodcastUploaded AND severity>=WARNING" \
  --limit=20 \
  --project=echoscribe-test

# Check if HTTP function was called
gcloud logging read "resource.labels.service_name=processpodcasthttp" \
  --limit=20 \
  --project=echoscribe-test

# Check for authentication errors
gcloud logging read "textPayload=~'authentication' OR textPayload=~'403'" \
  --limit=20 \
  --project=echoscribe-test
```

---

#### HTTP function returns 403 Forbidden

**Symptom:** Storage trigger fails with "403 Forbidden" when calling HTTP function

**Cause:** Missing `roles/run.invoker` permission for service account

**Solution:**
```bash
# Grant run.invoker role to compute service account
gcloud projects add-iam-policy-binding echoscribe-test \
  --member="serviceAccount:436441931185-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --condition=None
```

---

#### Vertex AI returns "Permission denied" error

**Symptom:** Processing fails with Vertex AI permission errors in logs

**Cause:** Missing `roles/aiplatform.user` permission for service account

**Solution:**
```bash
# Grant aiplatform.user role to compute service account
gcloud projects add-iam-policy-binding echoscribe-test \
  --member="serviceAccount:436441931185-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user" \
  --condition=None
```

---

#### Processing fails with "Quota not refunded" error

**Symptom:** Processing fails but quota is not returned to user

**Cause:** Error in quota refund logic or transaction failure

**Solution:** The system uses `safeRefundQuota()` which prevents negative quota. Check logs:
```bash
# Check for quota refund attempts
gcloud logging read "textPayload=~'Refunding quota' OR textPayload=~'safeRefundQuota'" \
  --limit=20 \
  --project=echoscribe-test
```

**Manual quota adjustment (if needed):**
```typescript
// In Firebase Console > Firestore
// Update user document: quota.used -= <duration_in_minutes>
```

---

#### Zombie tasks processing deleted podcasts

**Symptom:** Processing continues even after user deleted the podcast

**Status:** ✅ SOLVED in current architecture

**How it's prevented:**
1. `processPodcastHttp` checks if podcast exists before processing
2. Returns 200 OK if podcast deleted (prevents retries)
3. Transaction checks ensure atomic status updates

**Verify:**
```bash
# Check for zombie prevention logs
gcloud logging read "textPayload=~'zombie prevention' OR textPayload=~'not found - skipping'" \
  --limit=20 \
  --project=echoscribe-test
```

---

**Related Documentation:**
- [Deployment & Environments](./deployment-staging.md) - Environment setup and deployment workflows
