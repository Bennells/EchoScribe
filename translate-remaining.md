# Remaining Translation Tasks

This document tracks the remaining translations needed. The critical AI and configuration changes are complete.

## ✅ Completed
- Domain configuration (echoscribes.com)
- Email addresses (info@echoscribes.com)
- AI prompts (English, language auto-detection)
- Core layout (app/layout.tsx)
- SEO structured data
- Landing page metadata (app/page.tsx)
- Hero section

## 🔄 In Progress - Landing Components

Continue translating these files from German to English:

### how-it-works.tsx
- "Wie es funktioniert" → "How It Works"
- "In nur 3 Schritten" → "In Just 3 Steps"
- Step descriptions

### features-grid.tsx
- All feature titles and descriptions

### pricing-teaser.tsx
- Launch special messaging
- Plan features

### seo-benefits-section.tsx
- Benefit descriptions
- Stats section

### faq-section.tsx
- All FAQ questions and answers
- Support contact section

### final-cta.tsx
- CTA headline and copy

### navigation.tsx
- "Features", "Preise", "FAQ" nav labels
- "Anmelden", "Kostenlos starten" buttons

## 📋 Remaining Phases

### Phase 5: Legal Pages
- app/privacy/page.tsx - Full translation
- app/terms/page.tsx - Full translation
- app/imprint/page.tsx - Full translation

### Phase 6: Dashboard
- app/dashboard/page.tsx
- app/dashboard/podcasts/page.tsx
- app/dashboard/articles/page.tsx
- app/dashboard/settings/page.tsx
- app/pricing/page.tsx

### Phase 7: Auth
- app/(auth)/login/page.tsx
- app/(auth)/register/page.tsx

### Phase 8: Shared
- components/footer.tsx - "Datenschutz", "AGB", "Impressum", "Kontakt"
- components/features/cookie-banner.tsx

### Phase 9: Date Formatting
Replace `.toLocaleDateString("de-DE")` with locale-neutral:
- `.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' })`

### Phase 10: Documentation
- README.md

## Strategy
Given the large scope, continue file-by-file systematic translation while maintaining context and consistency.
