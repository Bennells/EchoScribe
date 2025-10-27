# EchoScribe

Wandeln Sie Podcasts automatisch in SEO-optimierte Blog-Artikel um.

## 🚀 Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Firebase Functions (Node.js 20)
- **Database:** Firestore
- **Storage:** Firebase Storage
- **Auth:** Firebase Authentication
- **AI:** Google Gemini 2.5 Flash
- **Payment:** Stripe
- **UI:** shadcn/ui Components
- **Monitoring:** Sentry (Production Error Tracking)

## 📋 Prerequisites

- Node.js 20+
- npm oder yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Gemini API Key (https://aistudio.google.com/app/apikey)

## 🛠️ Setup

### 1. Dependencies installieren

```bash
# Root dependencies
npm install

# Functions dependencies
cd functions
npm install
cd ..
```

### 2. Environment Variables

Die `.env.local` Datei ist bereits konfiguriert für lokale Entwicklung mit dem echten Firebase Backend (echoscribe-test).

**Für Production:** Die `.env.production` Datei enthält Platzhalter für das Production Firebase Backend (echoscribe-prod).

### 3. Firebase Backends

Die App nutzt **2 Firebase Backends**:

1. **echoscribe-test** - für Entwicklung und Testing
   - Localhost Development (`.env.local`)
   - Firebase App Hosting DEV/TEST (via `apphosting.yaml`)

2. **echoscribe-prod** - für Production
   - Firebase App Hosting Production

### 4. Development starten

```bash
npm run dev
```

Die App läuft auf: **http://localhost:3000**

### 5. Firebase Projekt wechseln

```bash
# Wechsel zu Test/Development
npm run firebase:use:test

# Wechsel zu Production
npm run firebase:use:prod
```

## 📁 Projektstruktur

```
├── app/                      # Next.js App Router
│   ├── (auth)/              # Auth-Pages (Login, Register)
│   ├── (dashboard)/         # Dashboard (Podcasts, Articles, Settings)
│   ├── api/                 # API Routes (Stripe Webhooks)
│   └── layout.tsx
├── components/
│   ├── ui/                  # shadcn/ui Base Components
│   └── features/            # Feature-spezifische Komponenten
├── functions/               # Firebase Cloud Functions
│   └── src/
│       ├── triggers/        # Firestore/Storage Triggers
│       ├── webhooks/        # Stripe Webhooks
│       └── services/        # Business Logic (Gemini Integration)
├── lib/
│   ├── firebase/           # Firebase Client SDK
│   └── utils/              # Helper Functions
├── types/                  # TypeScript Definitions
├── firebase.json           # Firebase Configuration
├── firestore.rules         # Firestore Security Rules
└── storage.rules           # Storage Security Rules
```

## 🔒 Security

- Firestore und Storage Rules sind bereits konfiguriert
- Nur authentifizierte User können ihre eigenen Daten lesen/schreiben
- Quota-System verhindert Missbrauch
- API Keys sind in .env.local (nicht im Git!)

## 🧪 Testing

```bash
# Build prüfen
npm run build

# Functions Build
cd functions && npm run build
```

## 📊 Monitoring (Production)

### Sentry Error Tracking

Sentry ist für **Production-Only** konfiguriert und trackt automatisch:
- Frontend Errors (React Components, API Calls)
- Backend Errors (Cloud Functions, Triggers)
- API Route Errors (Stripe Webhooks)

**Setup Anleitung:** Siehe [SENTRY_SETUP.md](./SENTRY_SETUP.md)

**Was wird getrackt:**
- Error Messages und Stack Traces
- User Context (welcher User hatte den Fehler)
- Breadcrumbs (Aktionen vor dem Fehler)
- Performance Metrics (optional)

**Vorteile:**
- Automatische Email-Benachrichtigungen bei neuen Fehlern
- Source Maps für lesbare Stack Traces
- Error Grouping und Trends
- Integration mit GitHub, Slack, etc.

## 📝 Nächste Schritte (Phase 2)

- [ ] Authentifizierung implementieren (Login, Register, Password Reset)
- [ ] Auth Context Provider
- [ ] Protected Routes Middleware
- [ ] DSGVO-Compliance (Cookie-Banner, Datenschutz, AGB)
- [ ] User-Dokument bei Registrierung erstellen (Cloud Function)

## 🤝 Contributing

Dieses Projekt ist aktuell in aktiver Entwicklung (MVP Phase 1 abgeschlossen).

## 📄 License

Proprietary - Alle Rechte vorbehalten.
