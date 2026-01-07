# EchoScribe

Automatically convert podcasts into SEO-optimized blog articles.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Firebase Functions (Node.js 20)
- **Database:** Firestore
- **Storage:** Firebase Storage
- **Auth:** Firebase Authentication
- **AI:** OpenAI (GPT-4o-transcribe, GPT-4o-mini)
- **Payment:** Stripe (Subscriptions, Checkout, Customer Portal)
- **UI:** shadcn/ui, Radix UI Components
- **Hosting:** Firebase App Hosting

## Features

- **Podcast Upload**: Upload audio files (MP3, WAV, M4A, etc.) up to 250 MB
- **AI Transcription**: Automatic transcription via OpenAI GPT-4o-transcribe
- **Article Generation**: AI-generated SEO-optimized blog articles with GPT-4o-mini
- **SEO Metadata**: Automatic generation of Schema.org, OpenGraph, and social media metadata
- **Multi-language Support**: Automatic language detection for article generation
- **Subscription Plans**: Starter, Professional, and Business tiers via Stripe
- **User Dashboard**: Manage podcasts, articles, and account settings
- **GDPR Compliance**: Cookie banner, Privacy Policy, Terms of Service, Imprint

## Prerequisites

- Node.js 20+
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- OpenAI API Key (https://platform.openai.com/api-keys)
- Stripe Account (https://stripe.com)

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

Create a `.env.local` file based on `.env.example`:

```bash
cp .env.example .env.local
```

Required environment variables:
- Firebase configuration (API Key, Auth Domain, Project ID, etc.)
- OpenAI API Key
- Stripe API Keys and Price IDs

### 3. Firebase Backends

The app uses **2 Firebase backends**:

1. **echoscribe-test** - for Development and Testing
   - Localhost Development (`.env.local`)
   - Firebase App Hosting DEV/TEST (via `apphosting.test.yaml`)

2. **echoscribe-prod** - for Production
   - Firebase App Hosting Production (via `apphosting.prod.yaml`)

### 4. Start Development

```bash
npm run dev
```

The app runs at: **http://localhost:3000**

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
│   ├── (auth)/              # Auth Pages (Login, Register, Forgot Password)
│   ├── api/                 # API Routes
│   │   ├── auth/            # Auth endpoints
│   │   ├── account/         # Account management
│   │   ├── stripe/          # Stripe integration (Checkout, Portal, Subscriptions)
│   │   └── webhooks/        # Webhook handlers
│   ├── dashboard/           # Dashboard (Podcasts, Articles, Settings, Pricing)
│   ├── pricing/             # Pricing page
│   ├── privacy/             # Privacy Policy
│   ├── terms/               # Terms of Service
│   └── imprint/             # Imprint
├── components/
│   ├── ui/                  # shadcn/ui Base Components
│   ├── features/            # Feature Components
│   │   ├── auth/            # Authentication components
│   │   ├── billing/         # Billing components
│   │   ├── landing/         # Landing page components
│   │   ├── podcast-upload/  # Upload components
│   │   ├── pricing/         # Pricing components
│   │   ├── settings/        # Settings components
│   │   └── subscription/    # Subscription components
│   ├── dashboard/           # Dashboard components
│   └── seo/                 # SEO components
├── functions/               # Firebase Cloud Functions
│   └── src/
│       ├── http/            # HTTP Cloud Functions
│       ├── triggers/        # Firestore/Storage Triggers
│       ├── scheduled/       # Scheduled Functions (Cleanup)
│       └── services/        # Business Logic
│           └── openai/      # OpenAI Pipeline (Transcription, Article, Metadata)
├── lib/
│   ├── firebase/           # Firebase Client SDK
│   │   ├── auth.ts         # Auth functions
│   │   ├── auth-context.tsx # Auth context provider
│   │   └── config.ts       # Firebase config
│   ├── audio/              # Audio utilities
│   ├── constants/          # App constants
│   └── utils/              # Helper functions
├── types/                  # TypeScript Definitions
├── public/                 # Static assets
├── firebase.json           # Firebase Configuration
├── firestore.rules         # Firestore Security Rules
├── storage.rules           # Storage Security Rules
└── apphosting.*.yaml       # App Hosting configs
```

## OpenAI Processing Pipeline

The podcast processing uses a multi-stage OpenAI pipeline:

1. **Stage 0 - Transcription**: GPT-4o-transcribe API converts audio to text
2. **Stage 1 - Article Generation**: GPT-4o-mini generates SEO-optimized article from transcript
3. **Stage 2 - Metadata Generation**: GPT-4o-mini generates Schema.org, OpenGraph, and social media metadata

Features:
- Automatic language detection
- Audio chunking for large files (via ffmpeg)
- Circuit breaker for API resilience
- Cost tracking (USD/EUR)

## Security

- Firestore and Storage Rules are configured for authenticated access
- Users can only read/write their own data
- Quota system prevents abuse
- API keys stored in environment variables
- Stripe webhooks verified with signing secret

## Deployment

### Deploy Functions

```bash
# Deploy to Test
npm run deploy:functions:test

# Deploy to Production
npm run deploy:functions:prod
```

### Deploy Everything

```bash
# Deploy to Test
npm run deploy:test

# Deploy to Production
npm run deploy:prod
```

### App Hosting

App Hosting deploys automatically via GitHub integration. See `apphosting.*.yaml` for configuration.

## Testing

```bash
# Check build
npm run build

# Functions build
cd functions && npm run build

# Lint
npm run lint

# Format
npm run format
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run firebase:use:test` | Switch to test Firebase project |
| `npm run firebase:use:prod` | Switch to prod Firebase project |
| `npm run deploy:functions:test` | Deploy functions to test |
| `npm run deploy:functions:prod` | Deploy functions to prod |
| `npm run deploy:test` | Deploy all to test |
| `npm run deploy:prod` | Deploy all to prod |

## License

Proprietary - All rights reserved.
