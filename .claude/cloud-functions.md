# EchoScribe - Cloud Functions Architecture

## Overview

All Cloud Functions use automatic region configuration based on environment:
- **TEST** (`echoscribe-test`): `europe-west1` (Multi-Region EU)
- **PROD** (`echoscribe-prod`): `europe-west3` (Deutschland)
- **Service Account:** `436441931185-compute@developer.gserviceaccount.com` (TEST)

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

## Podcast Processing Flow (Cloud Tasks)

**Architecture:** Storage Trigger → Cloud Tasks Queue → Task Handler → Gemini Processing

```
1. User uploads audio file
   ↓
2. onPodcastUploaded (Storage Trigger)
   - Creates Firestore document (status: "queued")
   - Enqueues Cloud Task
   - Returns immediately (~1-2 seconds)
   ↓
3. Cloud Tasks Queue (processPodcastTask)
   - Picks up task from queue
   - Max 3 concurrent tasks
   - Automatic retry (5 attempts with exponential backoff)
   ↓
4. processPodcastTask (Task Handler)
   - Downloads audio from Storage
   - Updates status to "processing"
   - Sends to Gemini API (2-10 minutes)
   - Generates blog article
   - Saves to Firestore
   - Updates status to "completed"
```

## Key Implementation Details

### Task Queue Configuration

**File:** `functions/src/lib/taskQueue.ts`

```typescript
// IMPORTANT: For non-default regions (europe-west1), use this format:
const queuePath = "locations/europe-west1/functions/processPodcastTask";
const functionUri = "https://europe-west1-echoscribe-test.cloudfunctions.net/processPodcastTask";

const queue = getFunctions().taskQueue(queuePath);

await queue.enqueue(
  { podcastId, storagePath },
  {
    scheduleDelaySeconds: 0,
    dispatchDeadlineSeconds: 30 * 60,  // Max 30 minutes (API limit)
    uri: functionUri,  // REQUIRED for Cloud Tasks routing
  }
);
```

### Critical Requirements

1. ✅ **Queue path format:** `locations/{region}/functions/{functionName}`
   - For non-default regions (not `us-central1`), must use full path
   - Cannot use simple function name for custom regions

2. ✅ **URI option required:** Must include `uri` in enqueue options
   - Tells Cloud Tasks where to send the HTTP request
   - Must be the full Cloud Functions URL

3. ✅ **Dispatch deadline:** Max 1800 seconds (30 minutes)
   - API limit enforced by Firebase Admin SDK
   - Task handler can run longer (1 hour), but dispatch must complete within 30 min

4. ✅ **Task handler timeout:** 3600 seconds (1 hour)
   - Configured in `processPodcastTask` function options
   - Sufficient time for large audio file processing

5. ✅ **Memory allocation:** 1 GiB
   - Required for processing large audio files (up to 20 MB)
   - Base64 encoding increases size by ~33%

## Function Configuration

### onPodcastUploaded (Storage Trigger)

**Type:** Storage Trigger (`onObjectFinalized`)
**Timeout:** ~60 seconds (default)
**Memory:** 256 MB (default)
**Trigger:** File upload to `podcasts/{userId}/{filename}` path

**Responsibilities:**
1. Extract userId and filename from storage path
2. Create Firestore document with status "queued"
3. Enqueue Cloud Task for background processing
4. Return immediately (fast response)

**File:** `functions/src/triggers/onPodcastUploaded.ts`

### processPodcastTask (Task Handler)

**Type:** Cloud Task Handler (`onTaskDispatched`)
**Timeout:** 3600 seconds (1 hour)
**Memory:** 1 GiB
**Region:** europe-west1

**Responsibilities:**
1. Update Firestore status to "processing"
2. Download audio file from Storage
3. Send to Gemini API for transcription and article generation
4. Parse and validate Gemini response
5. Save article to Firestore
6. Update podcast status to "completed"
7. Increment user quota

**File:** `functions/src/tasks/processPodcastTask.ts`

**Error Handling:**
- Automatic retry up to 5 attempts
- Exponential backoff: 60s → 120s → 240s → 3600s
- Updates podcast status to "error" on final failure

## Cloud Tasks Queue Configuration

**Queue Name:** `processPodcastTask`
**Location:** `europe-west1`

**Settings:**
- **Max concurrent dispatches:** 3
  - Prevents overwhelming Gemini API
  - Prevents storage/memory issues from too many parallel downloads

- **Max attempts:** 5
  - Automatic retry on failure
  - Handles transient Gemini API issues

- **Backoff configuration:**
  - **Min backoff:** 60 seconds
  - **Max backoff:** 3600 seconds (1 hour)
  - **Max doublings:** 3
  - **Pattern:** 1min → 2min → 4min → 1hr → 1hr

**View queue:**
```bash
gcloud tasks queues describe processPodcastTask \
  --location=europe-west1 \
  --project=echoscribe-test
```

## IAM Permissions Required

**Service Account:** `436441931185-compute@developer.gserviceaccount.com`

**Required Roles:**

| Role | Purpose |
|------|---------|
| `roles/cloudtasks.enqueuer` | Enqueue tasks to Cloud Tasks queue |
| `roles/cloudtasks.taskRunner` | Execute tasks from queue |
| `roles/datastore.user` | Read/write Firestore documents |
| `roles/secretmanager.secretAccessor` | Access GEMINI_API_KEY secret |
| `roles/storage.objectViewer` | Read audio files from Storage |

**Verify permissions:**
```bash
gcloud projects get-iam-policy echoscribe-test \
  --flatten="bindings[].members" \
  --filter="bindings.members:436441931185-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

## Deployment

### Deploy all functions:
```bash
firebase use test
firebase deploy --only functions
```

### Deploy specific function:
```bash
firebase deploy --only functions:onPodcastUploaded
firebase deploy --only functions:processPodcastTask
```

### View logs:
```bash
# All functions
firebase functions:log --project echoscribe-test

# Specific function
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=onPodcastUploaded" \
  --limit=50 \
  --project=echoscribe-test
```

## Troubleshooting

### Common Issues & Solutions

#### ✅ SOLVED: "Queue does not exist" error

**Symptom:**
```
FirebaseFunctionsError: Queue does not exist. If you just created the queue,
wait at least a minute for the queue to initialize.
```

**Cause:** Wrong queue reference format

**Solution:** Use qualified resource name format:
```typescript
// ❌ Wrong (for non-default regions)
const queue = getFunctions().taskQueue("processPodcastTask");

// ✅ Correct
const queue = getFunctions().taskQueue("locations/europe-west1/functions/processPodcastTask");
```

---

#### ✅ SOLVED: "Function name must be a single string or a qualified resource name"

**Symptom:**
```
FirebaseFunctionsError: Function name must be a single string or a qualified resource name
```

**Cause:** Using Extension URI instead of qualified resource name

**Solution:** Use `locations/{region}/functions/{name}` format, NOT the HTTPS URL:
```typescript
// ❌ Wrong
const queue = getFunctions().taskQueue(
  "https://europe-west1-echoscribe-test.cloudfunctions.net/processPodcastTask"
);

// ✅ Correct
const queue = getFunctions().taskQueue(
  "locations/europe-west1/functions/processPodcastTask"
);
```

---

#### ✅ SOLVED: "dispatchDeadlineSeconds must be in the range of 15s to 30 mins"

**Symptom:**
```
dispatchDeadlineSeconds must be a non-negative duration in seconds and
must be in the range of 15s to 30 mins.
```

**Cause:** Set to 3600 seconds (1 hour), but API max is 1800 seconds (30 minutes)

**Solution:** Use 30 minutes max for dispatch deadline:
```typescript
await queue.enqueue(data, {
  dispatchDeadlineSeconds: 30 * 60,  // ✅ 30 minutes (max)
  // NOT: 60 * 60  // ❌ 1 hour (exceeds limit)
});
```

**Note:** Task handler can still run for 1 hour; this limit is only for the dispatch/enqueue operation.

---

#### ✅ SOLVED: Gemini not processing uploaded files

**Symptom:** Files upload successfully, Firestore document created with status "queued", but never progresses to "processing"

**Root Cause:** Combination of issues:
1. Incorrect queue path format for non-default region
2. Missing `uri` option in enqueue call
3. Task not being dispatched to Cloud Tasks

**Solution:** Use correct format with both requirements:
```typescript
const queuePath = "locations/europe-west1/functions/processPodcastTask";
const functionUri = "https://europe-west1-echoscribe-test.cloudfunctions.net/processPodcastTask";

const queue = getFunctions().taskQueue(queuePath);

await queue.enqueue(data, {
  uri: functionUri,  // ← REQUIRED!
  dispatchDeadlineSeconds: 30 * 60,
});
```

---

**Related Documentation:**
- [Deployment & Environments](./deployment-staging.md) - Environment setup and deployment workflows
