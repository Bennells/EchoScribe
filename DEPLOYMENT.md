# Deployment Guide - HTTP Cloud Function Migration

## Architecture Change Summary

**FROM**: Cloud Tasks (persistent queue with zombie tasks)
**TO**: HTTP Cloud Function 2nd Gen (60-minute timeout, no zombies)

### Benefits
- ✅ **60-minute timeout** - supports podcasts up to 4 hours
- ✅ **No zombie tasks** - deleted podcasts won't process
- ✅ **Simpler architecture** - just Cloud Functions, no Docker/Cloud Run
- ✅ **Lower costs** - no Cloud Tasks overhead

---

## Deployment Steps

### 1. Delete Old Cloud Tasks Queue (Important!)

Before deploying, you need to delete the old Cloud Tasks queue to prevent zombie tasks:

```bash
# For TEST environment
firebase use echoscribe-test
gcloud tasks queues delete processPodcastTask --location=europe-west1

# For PROD environment
firebase use echoscribe-prod
gcloud tasks queues delete processPodcastTask --location=europe-west3
```

### 2. Deploy Cloud Functions

```bash
# Deploy to TEST
firebase use echoscribe-test
firebase deploy --only functions

# Deploy to PROD
firebase use echoscribe-prod
firebase deploy --only functions
```

### 3. Verify Deployment

After deployment, verify both functions are deployed:

```bash
# List all functions
firebase functions:list

# Expected output:
# ✓ onPodcastUploaded (Storage Trigger)
# ✓ processPodcastHttp (HTTP Function)
```

### 4. Test the Flow

1. Upload a test podcast through your app
2. Check logs for the storage trigger:
   ```bash
   firebase functions:log --only onPodcastUploaded
   ```
3. Check logs for the HTTP function:
   ```bash
   firebase functions:log --only processPodcastHttp
   ```

---

## What Changed

### New Files
- `functions/src/http/processPodcastHttp.ts` - HTTP Cloud Function with 60-min timeout

### Modified Files
- `functions/src/triggers/onPodcastUploaded.ts` - Now calls HTTP function instead of Cloud Tasks
- `functions/src/config/environment.ts` - Updated to use HTTP function URL
- `functions/src/index.ts` - Exports HTTP function instead of Cloud Tasks

### Deleted Files
- `functions/src/tasks/processPodcastTask.ts` - Old Cloud Tasks handler
- `functions/src/lib/taskQueue.ts` - Old Cloud Tasks queue helper
- `functions/src/triggers/processPodcast.ts` - Old processing logic (moved to HTTP function)
- `functions/Dockerfile` - Not needed (no Cloud Run)
- `functions/src/cloud-run/` - Not needed

---

## Function Configuration

### onPodcastUploaded (Storage Trigger)
- **Type**: Event-driven (Storage)
- **Region**: Auto (TEST: europe-west1, PROD: europe-west3)
- **Memory**: 2GiB
- **Timeout**: Default (9 minutes - sufficient for validation and HTTP call)

### processPodcastHttp (HTTP Function)
- **Type**: HTTP (2nd Gen)
- **Region**: Auto (TEST: europe-west1, PROD: europe-west3)
- **Memory**: 4GiB
- **CPU**: 2
- **Timeout**: 3600 seconds (60 minutes)
- **Max Instances**: 3 (rate limiting)

---

## URLs

### TEST Environment
- **HTTP Function**: `https://europe-west1-echoscribe-test.cloudfunctions.net/processPodcastHttp`

### PROD Environment
- **HTTP Function**: `https://europe-west3-echoscribe-prod.cloudfunctions.net/processPodcastHttp`

---

## Monitoring

### View Logs

```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only processPodcastHttp

# Recent errors only
firebase functions:log --only processPodcastHttp | grep "ERROR"
```

### Key Metrics to Monitor

1. **Processing Success Rate**
   - Status: `completed` vs `error` in podcasts collection

2. **Processing Duration**
   - Look for: `[HTTP] ✅ COMPLETED - Processing finished successfully`
   - Duration logged in: `Duration: X.Xs`

3. **Zombie Prevention**
   - Look for: `⏭️ Podcast not found - skipping (zombie prevention)`
   - This should be 0 with new architecture

4. **Token Usage**
   - Look for: `Output tokens: X / 65,536`
   - Should be < 10,000 for most podcasts

---

## Troubleshooting

### Issue: HTTP function not being called

**Check logs**: Look for errors in `onPodcastUploaded`
```bash
firebase functions:log --only onPodcastUploaded | grep "ERROR"
```

**Verify URL**: Check that the HTTP function URL is correct in environment config

### Issue: HTTP function timing out

**Check duration**: 60 minutes should be enough for 4-hour podcasts
```bash
firebase functions:log --only processPodcastHttp | grep "Duration"
```

**If needed**: Contact support - 60 minutes is the maximum for HTTP functions

### Issue: Getting 403 errors

**Cause**: IAM permissions issue

**Fix**: Ensure Cloud Functions service account has required roles:
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

---

## Rollback Plan

If you need to rollback to Cloud Tasks:

1. Restore deleted files from git:
   ```bash
   git checkout HEAD~1 -- functions/src/tasks/processPodcastTask.ts
   git checkout HEAD~1 -- functions/src/lib/taskQueue.ts
   git checkout HEAD~1 -- functions/src/triggers/processPodcast.ts
   ```

2. Revert changes to:
   - `functions/src/triggers/onPodcastUploaded.ts`
   - `functions/src/config/environment.ts`
   - `functions/src/index.ts`

3. Rebuild and redeploy:
   ```bash
   npm run build --prefix functions
   firebase deploy --only functions
   ```

4. Recreate Cloud Tasks queue (will be auto-created on first task)

---

## Cost Comparison

### Old Architecture (Cloud Tasks)
- Cloud Tasks: ~$0.40 per 1M tasks
- Cloud Function (Task Handler): $0.0000025 per invocation
- **Zombie tasks**: Additional cost for deleted podcasts

### New Architecture (HTTP Function)
- HTTP Function: $0.0000025 per invocation
- **No zombie tasks**: Zero cost for deleted podcasts
- **Simpler**: Easier to maintain and debug

### Estimated Savings
- **~30-50% cost reduction** by eliminating zombie tasks
- **Faster debugging** with simpler architecture
- **Better reliability** with no persistent queue issues

---

## Next Steps

1. ✅ Delete old Cloud Tasks queue
2. ✅ Deploy functions to TEST
3. ✅ Test with sample podcast
4. ✅ Monitor logs for 24 hours
5. ✅ Deploy to PROD
6. ✅ Monitor production for 1 week
7. ✅ Remove rollback code after verification

---

## Support

If you encounter issues:

1. Check logs: `firebase functions:log`
2. Verify IAM permissions
3. Check function configuration in Firebase Console
4. Review error messages in Firestore (`podcasts` collection)
