# EchoScribe

Transform podcasts automatically into SEO-optimized blog articles.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Firebase Functions (Node.js 20)
- **Database:** Firestore
- **Storage:** Firebase Storage
- **Auth:** Firebase Authentication
- **AI:** OpenAI (GPT-4o & Whisper)
- **Payment:** Stripe
- **UI:** shadcn/ui Components

## Prerequisites

- Node.js 20+
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- OpenAI API Key (https://platform.openai.com/api-keys)

## Setup

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Functions dependencies
cd functions
npm install
cd ..
```

### 2. Environment Variables

The `.env.local` file is configured for local development with the real Firebase backend (echoscribe-test).

**For Production:** The `.env.production` file contains placeholders for the production Firebase backend (echoscribe-prod).

### 3. Firebase Backends

The app uses **2 Firebase backends**:

1. **echoscribe-test** - for development and testing
   - Localhost Development (`.env.local`)
   - Firebase App Hosting DEV/TEST (via `apphosting.yaml`)

2. **echoscribe-prod** - for production
   - Firebase App Hosting Production

### 4. Start Development

```bash
npm run dev
```

The app runs on: **http://localhost:3000**

### 5. Switch Firebase Project

```bash
# Switch to Test/Development
npm run firebase:use:test

# Switch to Production
npm run firebase:use:prod
```

## Project Structure

```
├── app/                      # Next.js App Router
│   ├── (auth)/              # Auth Pages (Login, Register)
│   ├── (dashboard)/         # Dashboard (Podcasts, Articles, Settings)
│   ├── api/                 # API Routes (Stripe Webhooks)
│   └── layout.tsx
├── components/
│   ├── ui/                  # shadcn/ui Base Components
│   └── features/            # Feature-specific Components
├── functions/               # Firebase Cloud Functions
│   └── src/
│       ├── triggers/        # Firestore/Storage Triggers
│       ├── webhooks/        # Stripe Webhooks
│       └── services/        # Business Logic (OpenAI Integration)
├── lib/
│   ├── firebase/           # Firebase Client SDK
│   └── utils/              # Helper Functions
├── types/                  # TypeScript Definitions
├── firebase.json           # Firebase Configuration
├── firestore.rules         # Firestore Security Rules
└── storage.rules           # Storage Security Rules
```

## Security

- Firestore and Storage Rules are configured
- Only authenticated users can read/write their own data
- Quota system prevents abuse
- API Keys are in .env.local (not in Git!)

## Testing

```bash
# Check build
npm run build

# Functions Build
cd functions && npm run build
```

## Deployment

```bash
# Deploy functions to test
npm run deploy:functions:test

# Deploy functions to production
npm run deploy:functions:prod

# Deploy everything to test
npm run deploy:test

# Deploy everything to production
npm run deploy:prod
```

## Features

- Audio file upload (MP3, WAV, M4A - max 250 MB)
- Automatic transcription via OpenAI Whisper
- AI-powered article generation with customizable tone and style
- Multi-language support with automatic language detection
- SEO optimization for generated content
- Stripe subscription management
- User quota tracking

## License

Proprietary - All rights reserved.
