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

Die `.env.local` Datei ist bereits konfiguriert für lokale Entwicklung mit Firebase Emulator.

**Für Production später:** Aktualisieren Sie die Firebase Config und fügen Sie echte Stripe Keys hinzu.

### 3. Development starten

**Option A: Separate Terminals**

Terminal 1 - Next.js Dev Server:
```bash
npm run dev
```

Terminal 2 - Firebase Emulator:
```bash
npm run emulators
```

**Option B: Parallel (mit concurrently)**

```bash
npm run dev:all
```

### 4. URLs

- **Next.js App:** http://localhost:3000
- **Firebase Emulator UI:** http://localhost:4000
- **Firestore Emulator:** http://localhost:8080
- **Auth Emulator:** http://localhost:9099
- **Functions Emulator:** http://localhost:5001
- **Storage Emulator:** http://localhost:9199

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
