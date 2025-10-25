# Sentry Integration - Implementation Summary

## ✅ Was wurde implementiert?

Die Sentry-Integration ist vollständig implementiert und **nur für Production** konfiguriert. In Development und Test-Umgebungen ist Sentry deaktiviert.

---

## 📦 Installierte Packages

### Frontend (Root)
```bash
npm install @sentry/nextjs --save
```
**Installiert:** ✅

### Backend (Cloud Functions)
```bash
cd functions && npm install @sentry/node --save
```
**Installiert:** ✅

---

## 📁 Neue Dateien

### Frontend Configuration
| Datei | Zweck |
|-------|-------|
| `sentry.client.config.ts` | Browser Error Tracking |
| `sentry.server.config.ts` | Server-side Error Tracking (API Routes, SSR) |
| `sentry.edge.config.ts` | Edge Runtime Error Tracking (Middleware) |
| `instrumentation.ts` | Node.js Instrumentation Hook |
| `app/global-error.tsx` | Root-level Error Handler |

### Backend Configuration
| Datei | Zweck |
|-------|-------|
| `functions/src/lib/sentry.ts` | Sentry Setup & Helper Functions |

### Dokumentation
| Datei | Zweck |
|-------|-------|
| `SENTRY_SETUP.md` | Vollständige Setup-Anleitung |
| `SENTRY_INTEGRATION_SUMMARY.md` | Diese Datei (Zusammenfassung) |

---

## 🔧 Aktualisierte Dateien

### Frontend
| Datei | Änderungen |
|-------|-----------|
| `next.config.js` | Sentry Webpack Plugin, Source Maps Upload |
| `app/error.tsx` | `Sentry.captureException()` hinzugefügt |
| `app/dashboard/error.tsx` | `Sentry.captureException()` mit tags |
| `components/error-boundary.tsx` | Sentry Error Reporting |
| `app/api/webhooks/stripe/route.ts` | Webhook Error Tracking |
| `README.md` | Monitoring-Sektion hinzugefügt |

### Backend (Cloud Functions)
| Datei | Änderungen |
|-------|-----------|
| `functions/src/index.ts` | Sentry-Import beim Start |
| `functions/src/tasks/processPodcastTask.ts` | Error Tracking mit Context |
| `functions/src/triggers/onPodcastUploaded.ts` | Error Tracking mit Context |
| `functions/src/callable/deleteUserAccount.ts` | Error Tracking mit User Context |

---

## 🎯 Was wird getrackt?

### Frontend Errors
✅ React Component Crashes
✅ API Call Failures
✅ Unhandled Promise Rejections
✅ Navigation Errors
✅ User Context (userId, email)
✅ Breadcrumbs (User-Aktionen vor Fehler)

### Backend Errors
✅ Cloud Function Crashes
✅ Gemini API Errors
✅ Firestore Write Failures
✅ Storage Operations Errors
✅ Retry Information (attemptNumber)
✅ Podcast/User Context

### API Route Errors
✅ Stripe Webhook Signature Failures
✅ Payment Processing Errors
✅ Subscription Update Failures
✅ Database Operation Errors

---

## 🚀 Nächste Schritte (für Sie)

### 1. Sentry Account erstellen (5 Minuten)

1. Gehen Sie zu: https://sentry.io/signup/
2. Registrieren Sie sich (kostenlos)
3. Erstellen Sie ein Projekt:
   - **Name:** `echoscribe` oder `echoscribe-prod`
   - **Platform:** Next.js
4. Kopieren Sie den **DSN** (wird angezeigt nach Projekterstellung):
   ```
   https://abc123...@o456.ingest.sentry.io/789
   ```

### 2. Auth Token erstellen (2 Minuten)

Für Source Maps Upload:

1. Sentry Dashboard → Settings → Account → Auth Tokens
2. Click "Create New Token"
3. **Name:** `echoscribe-sourcemaps`
4. **Scopes:** Wählen Sie:
   - ☑ `project:releases`
   - ☑ `project:write`
   - ☑ `org:read`
5. Click "Create Token"
6. **Kopieren Sie den Token sofort** (wird nur einmal angezeigt!)

### 3. Environment Variables setzen

#### `.env.production` (erstellen wenn nicht vorhanden)

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://IHRE_DSN_HIER@o456.ingest.sentry.io/789
SENTRY_ORG=ihre-organisation  # Finden Sie in Sentry Settings
SENTRY_PROJECT=echoscribe
SENTRY_AUTH_TOKEN=sntrys_IHR_AUTH_TOKEN_HIER

# Rest Ihrer Production Config (Firebase, Stripe, etc.)
# ...
```

#### Firebase Functions Secret (für Cloud Functions)

```bash
# Terminal
firebase use prod
firebase functions:secrets:set SENTRY_DSN

# Wenn gefragt, eingeben:
https://IHRE_DSN_HIER@o456.ingest.sentry.io/789
```

**Alternative:** Erstellen Sie `functions/.env` (weniger sicher):
```bash
SENTRY_DSN=https://IHRE_DSN_HIER@o456.ingest.sentry.io/789
```

### 4. Deployment testen

```bash
# Build (Source Maps werden automatisch hochgeladen)
npm run build

# Deploy Cloud Functions
firebase deploy --only functions --project prod

# Deploy Frontend (z.B. Vercel)
vercel --prod

# Oder Firebase Hosting
firebase deploy --only hosting --project prod
```

### 5. Testen ob es funktioniert

Nach Deployment:

**Test 1: Frontend Error**
Besuchen Sie eine nicht existierende Route: `https://ihre-domain.com/test-404`

**Test 2: API Error**
Senden Sie einen ungültigen Webhook:
```bash
curl -X POST https://ihre-domain.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": "invalid"}'
```

**Test 3: Check Sentry Dashboard**
Gehen Sie zu Sentry → Issues
Sie sollten die Errors innerhalb von 10-20 Sekunden sehen!

---

## 📊 Sentry Dashboard verstehen

Nach Setup sehen Sie im Dashboard:

### Issues Tab
Alle Fehler gruppiert nach Typ:
```
❌ TypeError: Cannot read property 'id' of undefined
📍 Location: app/dashboard/page.tsx:42
👤 User: user@example.com
🕒 Last seen: 2 minutes ago
📊 Occurred: 5 times
```

Click auf Issue zeigt:
- Stack Trace (mit Source Maps!)
- User Context (welcher User)
- Breadcrumbs (was User vorher gemacht hat)
- Device/Browser Info

### Alerts
Standardmäßig erhalten Sie Email bei:
- Jedem neuen Error (nicht vorher gesehen)
- Wenn Error häufig auftritt (>10x/Stunde)

Konfigurieren Sie Alerts unter: Alerts → Alert Rules

---

## 🔍 Häufige Szenarien

### Szenario 1: User kann Podcast nicht hochladen

**Was Sie sehen in Sentry:**
```
Error: Failed to process podcast
Function: processPodcastTask
User: user@example.com (uid: abc123)
Podcast ID: podcast_xyz789
Attempt: 3/5
Error: GeminiAPIError: Rate limit exceeded
Stack Trace:
  at processPodcast (functions/src/triggers/processPodcast.ts:45)
  at processPodcastTask (functions/src/tasks/processPodcastTask.ts:42)
```

**Was Sie tun:**
1. Klick auf "View in Sentry" in Email
2. Sehen Sie, dass Gemini API limit erreicht
3. Implementieren Sie Rate Limiting oder upgraden API Plan
4. Issue als "resolved" markieren

### Szenario 2: Stripe Webhook schlägt fehl

**Was Sie sehen in Sentry:**
```
Error: Webhook signature verification failed
Location: app/api/webhooks/stripe/route.ts:29
Tags: webhook_event: signature_verification_failed
Extra:
  - hasSignature: true
  - hasSecret: true
```

**Was Sie tun:**
1. Checken Sie `STRIPE_WEBHOOK_SECRET` in Production env vars
2. Verifizieren Sie Webhook endpoint in Stripe Dashboard
3. Teste mit `stripe trigger checkout.session.completed`

---

## 💰 Kosten & Limits

### Free Tier (aktuell für Sie)
- ✅ 5.000 Errors/Monat
- ✅ 30 Tage Retention
- ✅ 1 Team Member
- ✅ Email Alerts
- ✅ Source Maps
- ✅ Performance Monitoring (limited)

**Geschätzte Nutzung für EchoScribe:**
- ~100-500 Errors/Monat (wenn stabil)
- Free Tier reicht für die ersten 6-12 Monate

### Upgrade nötig wenn:
- Mehr als 5.000 Errors/Monat
- Mehr Retention gewünscht (>30 Tage)
- Slack/Discord Integration gewünscht
- Team > 1 Person

**Developer Plan:** $26/Monat für 50.000 Errors

---

## 🛟 Troubleshooting

### Problem: Keine Errors in Sentry

**Check:**
```bash
# 1. Ist DSN gesetzt?
echo $NEXT_PUBLIC_SENTRY_DSN

# 2. Ist NODE_ENV production?
echo $NODE_ENV

# 3. Build logs checken
npm run build 2>&1 | grep -i sentry
```

**Fix:**
Aktivieren Sie Debug-Modus temporär in `sentry.client.config.ts`:
```typescript
Sentry.init({
  dsn: SENTRY_DSN,
  debug: true,  // Enable für Testing
});
```

### Problem: Source Maps werden nicht hochgeladen

**Check:**
```bash
# Auth Token gesetzt?
echo $SENTRY_AUTH_TOKEN

# Org & Project richtig?
echo $SENTRY_ORG
echo $SENTRY_PROJECT
```

**Fix:**
Build mit verbose logging:
```bash
SENTRY_LOG_LEVEL=debug npm run build
```

### Problem: Zu viele Errors (Quota exceeded)

**Fix 1:** Filter non-actionable errors
Edit `sentry.client.config.ts`:
```typescript
beforeSend(event, hint) {
  // Ignore browser extension errors
  if (event.exception?.values?.[0]?.value?.includes("chrome-extension")) {
    return null;
  }
  return event;
}
```

**Fix 2:** Reduziere Sample Rate
```typescript
tracesSampleRate: 0.05,  // Nur 5% statt 10%
```

---

## ✅ Implementation Checklist

- [x] Frontend Packages installiert (`@sentry/nextjs`)
- [x] Backend Packages installiert (`@sentry/node`)
- [x] Config Files erstellt (client, server, edge)
- [x] Error Boundaries aktualisiert
- [x] Cloud Functions integriert
- [x] API Routes integriert (Stripe Webhooks)
- [x] Documentation erstellt (`SENTRY_SETUP.md`)
- [x] README aktualisiert

**Noch zu tun (von Ihnen):**
- [ ] Sentry Account erstellt
- [ ] DSN & Auth Token kopiert
- [ ] `.env.production` konfiguriert
- [ ] Firebase Functions Secret gesetzt
- [ ] Deployment zu Production
- [ ] Test-Errors ausgelöst
- [ ] Sentry Dashboard gecheckt
- [ ] Email Alerts konfiguriert

---

## 🎓 Wichtige Links

- **Vollständige Setup-Anleitung:** [SENTRY_SETUP.md](./SENTRY_SETUP.md)
- **Sentry Signup:** https://sentry.io/signup/
- **Sentry Docs (Next.js):** https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Sentry Docs (Node.js):** https://docs.sentry.io/platforms/node/
- **Issue Tracking:** https://docs.sentry.io/product/issues/

---

## 📞 Support

Bei Fragen zur Sentry-Integration:
1. Lesen Sie [SENTRY_SETUP.md](./SENTRY_SETUP.md)
2. Checken Sie Sentry Docs
3. Sentry Community Discord: https://discord.gg/sentry

---

**Status:** ✅ Implementation Complete
**Ready for:** Production Deployment
**Last Updated:** 2025-01-15
