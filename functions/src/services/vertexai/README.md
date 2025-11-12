# Vertex AI / Gemini Audio Processing Module

Dieses Modul verarbeitet Podcast-Audio-Dateien mit Google's Gemini 2.5 Flash über Vertex AI und generiert SEO-optimierte Blog-Artikel mit umfassenden Metadaten.

## Architektur-Übersicht

### Two-Stage Processing Pipeline

Die Verarbeitung erfolgt in **zwei separaten Stages**, um optimale Qualität und Kosteneffizienz zu erreichen:

```
┌─────────────────────────────────────────────────────────────────┐
│                      STAGE 1: Audio → Article                   │
├─────────────────────────────────────────────────────────────────┤
│ Input:  Podcast-Audio (gs://bucket/path)                        │
│ Model:  Gemini 2.5 Flash (Audio + Text Understanding)           │
│ Output: Teaser-Artikel (600-2000 Wörter)                        │
│         + Title, Meta Description, Keywords                      │
│ Tokens: ~2000-10000 (je nach Länge)                             │
│ Kosten: ~€0.001-0.01 (Audio + Text)                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   STAGE 2: Article → Metadata                   │
├─────────────────────────────────────────────────────────────────┤
│ Input:  Artikel-Text (Markdown)                                 │
│ Model:  Gemini 2.5 Flash (nur Text)                             │
│ Output: Schema.org JSON-LD, Open Graph Tags                     │
│         + 6 Social Media Posts (LinkedIn, Twitter, etc.)        │
│ Tokens: ~3000-8000                                               │
│ Kosten: ~€0.002-0.005 (nur Text)                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                 App Generation: HTML + Slug                     │
├─────────────────────────────────────────────────────────────────┤
│ - Markdown → HTML Konvertierung                                 │
│ - URL-Slug Generierung                                          │
│ - Keine API-Calls                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Vorteile der Two-Stage Architektur

1. **Dedizierte Token-Budgets**: Jede Stage hat ihr eigenes Budget (65536 Tokens), verhindert Abschneidungen
2. **Metadata-Regeneration**: Stage 2 kann ohne Audio-Neuverarbeitung wiederholt werden
3. **Kosteneffizienz**: Audio-Verarbeitung nur einmal, Metadata-Generierung günstiger
4. **Bessere Fehler-Isolation**: Fehler können stage-spezifisch behandelt werden
5. **Qualitätskontrolle**: Separate Validierung für Artikel und Metadata

## Modul-Struktur

```
vertexai/
├── index.ts              # Main entry point, orchestriert Pipeline
├── article.ts            # Stage 1: Audio → Article
├── metadata.ts           # Stage 2: Article → Metadata
├── client.ts             # Vertex AI Client (Singleton)
├── utils.ts              # Retry, Validation, Fixes
├── constants.ts          # Konfigurationswerte, Magic Numbers
├── cost-calculator.ts    # Token → EUR/USD Konvertierung
├── errors.ts             # Custom Error Classes mit Context
├── circuit-breaker.ts    # (geplant) Failure Protection
└── README.md             # Diese Datei
```

## Token-Limits & Kosten

### Gemini 2.5 Flash Pricing (Stand: 2025)

| Kategorie | Preis pro 1M Tokens (USD) | Preis (EUR, ~1.08 Wechselkurs) |
|-----------|---------------------------|---------------------------------|
| Text Input | $0.01875 | ~€0.0174 |
| Text Output | $0.075 | ~€0.0694 |
| Audio Input | $0.000125 pro Minute | ~€0.000116 pro Minute |

### Typische Kosten pro Podcast

| Podcast-Länge | Stage 1 Tokens | Stage 2 Tokens | Gesamt | Kosten (EUR) |
|---------------|----------------|----------------|--------|--------------|
| 15 Min | ~3,000 | ~4,000 | ~7,000 | €0.002-0.004 |
| 30 Min | ~5,000 | ~5,000 | ~10,000 | €0.004-0.008 |
| 60 Min | ~8,000 | ~6,000 | ~14,000 | €0.008-0.015 |
| 120 Min | ~12,000 | ~8,000 | ~20,000 | €0.015-0.025 |

**Hinweis**: Tatsächliche Kosten variieren je nach Artikel-Länge und Komplexität.

## Word-Count Targets

Das System passt die Artikel-Länge automatisch an die Podcast-Dauer an:

| Podcast-Dauer | Ziel-Wortanzahl | Strategie |
|---------------|-----------------|-----------|
| < 15 Min | 800-1000 Wörter | Kurz, kompakt |
| 15-30 Min | 800-1000 Wörter | Standard-Teaser |
| 30-90 Min | 1000-1500 Wörter | Ausführlicher |
| 90+ Min | 1500-2000 Wörter | Deep-Dive Teaser |

**Validation Minimum**: 400 Wörter (Hard Minimum, darunter wird abgelehnt)

## Fehlerbehandlung

### Retry-Strategien

1. **API-Level Retry**: `retryWithExponentialBackoff` (3 Versuche, 1s initial delay)
2. **Article-Level Retry**: Bei zu kurzen Artikeln (max. 2 Versuche mit verstärktem Prompt)
3. **Atomic Status Update**: Firestore Transaction verhindert Doppel-Verarbeitung

### Error Types (Custom Errors)

- `TokenLimitExceededError`: MAX_TOKENS finishReason
- `SafetyFilterError`: SAFETY finishReason
- `InvalidResponseFormatError`: Malformed JSON
- `ValidationError`: Validierung fehlgeschlagen
- `WordCountTooLowError`: Artikel zu kurz

### Structured Error Context

Alle Errors enthalten strukturierten Context:
```typescript
{
  stage: "stage1_article" | "stage2_metadata" | ...,
  code: "MAX_TOKENS_EXCEEDED" | "VALIDATION_FAILED" | ...,
  attempt: 1,
  maxAttempts: 3,
  storagePath: "podcasts/userId/file.mp3",
  durationMinutes: 45,
  partialResults: { wordCount: 350, finishReason: "STOP" },
  tokenUsage: { promptTokens: 5000, candidatesTokens: 3000 },
  originalError: Error,
  metadata: { ... }
}
```

## Token-Usage Tracking

Jeder API-Call tracked automatisch Token-Verbrauch und Kosten:

```typescript
{
  stage1: {
    inputTokens: 5234,
    outputTokens: 3127,
    totalTokens: 8361,
    costUSD: 0.003254,
    costEUR: 0.003014,
    audioCostUSD: 0.005625,  // 45 Min Audio
    audioCostEUR: 0.005208
  },
  stage2: {
    inputTokens: 4821,
    outputTokens: 3456,
    totalTokens: 8277,
    costUSD: 0.000349,
    costEUR: 0.000323
  },
  total: {
    totalTokens: 16638,
    totalCostUSD: 0.009228,
    totalCostEUR: 0.008545
  },
  calculatedAt: Date
}
```

Diese Daten werden:
- In Firestore gespeichert (Podcast-Dokument)
- In Logs ausgegeben
- Für Cost-Analytics verwendet

## Validierung

### Stage 1: Article Validation

- ✅ JSON-Struktur korrekt (`{`, `}`)
- ✅ Alle required Fields vorhanden (`markdown`, `title`, `metaDescription`, `keywords`)
- ✅ Word Count ≥ 400 Wörter
- ✅ finishReason === "STOP"
- ✅ Keine Truncation

### Stage 2: Metadata Validation

- ✅ JSON-Struktur korrekt
- ✅ Alle Top-Level Fields (`schemaOrg`, `openGraph`, `socialMedia`)
- ✅ Schema.org required fields (`@type`, `headline`, ...)
- ✅ Open Graph required fields (`og:title`, `og:description`, ...)
- ✅ Social Media 6 Plattformen (LinkedIn, Twitter, Instagram, Facebook, TikTok, Newsletter)
- ✅ finishReason === "STOP"

## Timeouts & Performance

| Operation | Timeout | Durchschnitt |
|-----------|---------|--------------|
| Cloud Function | 60 Min | 2-15 Min |
| Vertex AI Request | 45 Min (geplant) | 1-10 Min |
| Stage 1 (15 Min Podcast) | - | 30-120s |
| Stage 1 (60 Min Podcast) | - | 2-8 Min |
| Stage 2 | - | 15-60s |

## Circuit Breaker (Geplant)

**Status**: Noch nicht implementiert

Ziel: System-weite Failure Protection

- Öffnet nach 5 konsekutiven Fehlern
- Cooldown: 60 Sekunden
- Verhindert Quota-Verschwendung bei Vertex AI Ausfällen
- Gibt User schnelleres Feedback

## Verwendung

### Haupt-Pipeline

```typescript
import { processAudioTwoStage } from './services/vertexai';

const article = await processAudioTwoStage(
  "podcasts/userId/file.mp3",  // Storage path
  "audio/mpeg",                // MIME type
  45                           // Duration in minutes
);

console.log(article.title);
console.log(article.tokenUsage.total.totalCostEUR); // €0.008
```

### Stage 1 (nur Artikel)

```typescript
import { generateArticleDirectlyFromAudio } from './services/vertexai';

const article = await generateArticleDirectlyFromAudio(
  "podcasts/userId/file.mp3",
  "audio/mpeg",
  45
);

console.log(article.markdown);
console.log(article.tokenUsage.costEUR); // Stage 1 Kosten
```

### Stage 2 (nur Metadata)

```typescript
import { generateMetadataFromArticle } from './services/vertexai';

const metadata = await generateMetadataFromArticle(
  articleMarkdown,
  title,
  metaDescription
);

console.log(metadata.socialMedia.linkedin);
console.log(metadata.tokenUsage.costEUR); // Stage 2 Kosten
```

## Configuration

Alle Konfigurationswerte sind in `constants.ts` zentralisiert:

- Token-Limits
- Word-Count-Targets
- Retry-Konfiguration
- Timeout-Werte
- Pricing-Informationen
- Social Media Constraints

**Best Practice**: Nie hardcoded Magic Numbers verwenden, immer Konstanten importieren!

```typescript
import { MAX_OUTPUT_TOKENS_ARTICLE, MIN_WORD_COUNT } from './constants';
```

## Monitoring & Debugging

### Log-Level

- `INFO`: Pipeline-Fortschritt, Token-Usage, Kosten
- `WARN`: Retries, Auto-Fixes, Warnungen
- `ERROR`: Fehler mit vollständigem Context

### Wichtige Log-Patterns

```
[Direct] 📊 Token Usage: ...
[Direct] 💰 Cost Estimate: ...
[Stage 2] ✅ Metadata generation successful
[Two-Stage Pipeline] 💰 Total Cost: ...
```

### Cost-Analytics

Token-Usage-Daten können für Analytics verwendet werden:
- Durchschnittliche Kosten pro Podcast-Länge
- Token-Effizienz-Trends
- Billing-Reconciliation

## EU-Compliance

✅ **Vertex AI Region**: europe-west3 (Frankfurt)
✅ **Audio-Verarbeitung**: Direkt via Cloud Storage URIs (gs://...)
✅ **Kein File API**: Vermeidet US-Region-Transfers
✅ **GDPR-konform**: Alle Daten bleiben in EU

## Bekannte Limitations

1. **Audio-Formate**: Unterstützt audio/mpeg, audio/wav, audio/ogg, audio/flac
2. **Max. Audio-Länge**: ~4 Stunden (praktisches Limit durch Function-Timeout)
3. **Kein Streaming für Metadata**: Stage 2 nutzt `generateContent` statt `generateContentStream`
4. **Circuit Breaker**: Noch nicht implementiert (Priorität: hoch)

## Zukünftige Verbesserungen

### Geplant (Priorität: Hoch)
- ✅ Token-Usage Tracking → **Implementiert**
- ✅ Cost-Calculator → **Implementiert**
- ✅ Request-Deduplizierung → **Implementiert**
- ⬜ Circuit Breaker Pattern
- ⬜ Request-Level Timeouts (AbortController)
- ⬜ Progressive Feedback (processingStage → Frontend)

### Geplant (Priorität: Mittel)
- ⬜ Partial Results Recovery
- ⬜ Prompt-Builder Pattern (DRY prompts)
- ⬜ Context Caching für lange Podcasts

### Erwogen
- ⬜ Single-Stage Pipeline (alternativ, experimentell)
- ⬜ Streaming für Stage 2
- ⬜ Multi-Language Support

## Support & Kontakt

Bei Fragen oder Problemen:
1. Logs prüfen (Cloud Functions Console)
2. Token-Usage analysieren (Firestore Podcast-Dokument)
3. Error Context reviewen (strukturierte Errors)
4. GitHub Issues erstellen (falls Reproduzierbar)

---

**Letzte Aktualisierung**: 2025-11-12
**Version**: 2.0 (Two-Stage Pipeline mit Token-Tracking)
