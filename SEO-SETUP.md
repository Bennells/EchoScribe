# SEO-Setup für EchoScribe

## ✅ Implementiert

### 1. Sitemap (app/sitemap.ts)
- Automatisch generierte XML-Sitemap
- Enthält alle öffentlichen Seiten: /, /pricing, /privacy, /terms, /imprint
- Mit Prioritäten und Update-Frequenzen
- **URL:** https://echoscribe.de/sitemap.xml

### 2. robots.txt (public/robots.txt)
- Erlaubt Crawling öffentlicher Seiten
- Blockiert Dashboard, API-Routes und Auth-Seiten
- Verweist auf Sitemap
- **URL:** https://echoscribe.de/robots.txt

### 3. Metadata-System (lib/metadata.ts)
- Zentrale Konfiguration für alle SEO-Metadaten
- Wiederverwendbare `createMetadata()` Funktion
- Open Graph Tags (Facebook, LinkedIn, WhatsApp)
- Twitter Card Tags
- Canonical URLs
- noIndex-Option für private Seiten

### 4. Page-spezifische Metadata
Alle öffentlichen Seiten haben jetzt vollständige Metadata:

- **Landing Page (/)**: Erweiterte Description mit Keywords, volle OG/Twitter Tags
- **Pricing (/pricing)**: Optimiert mit USPs (0€ Start, Geld-zurück-Garantie)
- **Privacy (/privacy)**: Mit noIndex (nicht in Suchmaschinen)
- **Terms (/terms)**: Mit noIndex
- **Imprint (/imprint)**: Mit noIndex

### 5. Structured Data (JSON-LD)
Landing Page enthält jetzt:

#### Organization Schema
- Firmendaten
- Kontaktinformationen
- Logo-Verweis

#### WebSite Schema
- Website-Beschreibung
- Sprache: de-DE
- Search Action für Dashboard-Suche

#### FAQPage Schema
- 4 FAQ-Einträge strukturiert
- Optimiert für Google Rich Snippets
- Erhöht Chance auf Featured Snippets

#### SoftwareApplication Schema
- Produkt-Beschreibung
- Pricing-Info (€0-149)
- Feature-Liste
- Screenshots-Verweis

---

## 📋 Was du als Nächstes tun musst

### 1. Google Search Console einrichten
**Wichtig:** Das ist der kritischste Schritt!

1. Gehe zu: https://search.google.com/search-console
2. Klicke auf "Property hinzufügen"
3. Wähle "Domain" (nicht URL-Präfix)
4. Gib deine Domain ein: `echoscribe.de`
5. Google zeigt dir einen TXT-Record an
6. Gehe zu deinem **Domain-Anbieter** (z.B. Strato, 1&1, GoDaddy)
7. Füge den TXT-Record in den DNS-Einstellungen hinzu
8. Warte 5-15 Minuten
9. Klicke in Google Search Console auf "Bestätigen"

### 2. Sitemap bei Google einreichen
Nach erfolgreicher Verifizierung:

1. In der Google Search Console links auf "Sitemaps" klicken
2. URL eingeben: `sitemap.xml`
3. Auf "Senden" klicken
4. Google beginnt automatisch mit dem Crawling

**Erwartung:** Innerhalb von 1-7 Tagen erscheinen die ersten Seiten im Google-Index.

### 3. Erste Indexierung prüfen
Nach ca. 3-5 Tagen in Google suchen:

```
site:echoscribe.de
```

Das zeigt dir alle indexierten Seiten.

---

## 🎨 Optional: Bilder hinzufügen (später)

### Open Graph Image
Ein OG-Image verbessert das Teilen auf Social Media erheblich.

**So fügst du es hinzu:**
1. Erstelle ein Bild 1200x630px (z.B. mit Canva, Figma, PowerPoint)
2. Speichere es als `opengraph-image.png` oder `opengraph-image.jpg`
3. Lege es hier ab: `app/opengraph-image.png`
4. Next.js erkennt es automatisch!

**Empfohlener Inhalt:**
- EchoScribe Logo
- Slogan: "Podcast → Blog-Artikel"
- Hintergrund in Brand-Farben (blau/violett)
- Text: "Automatisch SEO-optimiert"

### Favicon/Icons
Für Browser-Tabs und Lesezeichen:

1. Erstelle ein Icon (512x512px)
2. Speichere als: `app/icon.png`
3. Next.js generiert automatisch alle benötigten Größen

### Screenshot
Für SoftwareApplication Schema:

1. Mache einen Screenshot vom Dashboard
2. Speichere als: `public/screenshot.png`

### Logo
Für Organization Schema:

1. Speichere dein Logo als: `public/logo.png`

---

## 🔍 SEO-Features im Überblick

| Feature | Status | Wo implementiert |
|---------|--------|------------------|
| Sitemap.xml | ✅ | app/sitemap.ts |
| robots.txt | ✅ | public/robots.txt |
| Meta Title/Description | ✅ | Alle Pages |
| Open Graph Tags | ✅ | lib/metadata.ts |
| Twitter Cards | ✅ | lib/metadata.ts |
| Canonical URLs | ✅ | lib/metadata.ts |
| Organization Schema | ✅ | components/seo/structured-data.tsx |
| WebSite Schema | ✅ | components/seo/structured-data.tsx |
| FAQPage Schema | ✅ | components/seo/structured-data.tsx |
| SoftwareApplication Schema | ✅ | components/seo/structured-data.tsx |
| OG Image | ⏳ Optional | app/opengraph-image.png |
| Favicon | ⏳ Optional | app/icon.png |

---

## 📊 Monitoring & Verbesserungen

### Nach 1 Woche
- Prüfe in Google Search Console: Wie viele Seiten wurden indexiert?
- Gibt es Crawling-Fehler?
- Werden die strukturierten Daten erkannt?

### Nach 1 Monat
- Erste Impressions in der Search Console?
- Für welche Keywords erscheint die Seite?
- Gibt es Klicks aus der Google-Suche?

### Langfristige Optimierung
- Blog-Artikel schreiben (z.B. "So nutzen Sie Podcasts für SEO")
- Backlinks aufbauen (Gastbeiträge, Verzeichnisse)
- Meta-Descriptions basierend auf Klickrate optimieren
- Mehr Structured Data hinzufügen (z.B. HowTo-Schema)

---

## 🛠️ Technische Details

### Umgebungsvariable
Die Base-URL wird automatisch erkannt:

```env
NEXT_PUBLIC_BASE_URL=https://echoscribe.de
```

Falls nicht gesetzt, wird `https://echoscribe.de` als Fallback verwendet.

### Metadata-Funktion nutzen
Für neue Seiten:

```typescript
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Dein Titel",
  description: "Deine Beschreibung",
  path: "/dein-pfad",
  noIndex: false, // optional, default: false
});
```

### Structured Data hinzufügen
In jeder Page-Komponente:

```typescript
import { OrganizationSchema } from "@/components/seo/structured-data";

export default function Page() {
  return (
    <>
      <OrganizationSchema />
      {/* Dein Content */}
    </>
  );
}
```

---

## ✅ Checkliste

- [x] Sitemap erstellt
- [x] robots.txt erstellt
- [x] Metadata auf allen Seiten
- [x] Structured Data implementiert
- [ ] Google Search Console eingerichtet
- [ ] Sitemap bei Google eingereicht
- [ ] OG-Image erstellt (optional)
- [ ] Favicon erstellt (optional)

---

**Viel Erfolg mit deiner SEO-Optimierung! 🚀**
