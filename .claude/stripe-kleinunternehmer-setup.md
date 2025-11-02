# Stripe Rechnungsstellung für Kleinunternehmer (§ 19 UStG)

Diese Anleitung beschreibt die Konfiguration von Stripe für Kleinunternehmer nach § 19 UStG, die **keine Umsatzsteuer** berechnen.

## ✅ Code-Konfiguration (Bereits implementiert)

Die Stripe Tax Berechnung ist **hardcoded deaktiviert** für Kleinunternehmer:

```typescript
// In app/api/stripe/create-checkout-session/route.ts
const enableStripeTax = false; // Kleinunternehmer § 19 UStG
```

- ✅ `false`: Keine automatische Steuerberechnung (Kleinunternehmer)
- ✅ Zum Aktivieren: Ändern Sie Zeile 60 von `false` auf `true`

## 📋 Stripe Dashboard Konfiguration (Erforderlich)

### 1. ⚠️ Stripe Tax NICHT aktivieren

**Wichtig:** Als Kleinunternehmer dürfen Sie **KEINE** Umsatzsteuer berechnen!

- **NICHT** auf "Start now" bei "Collect tax, file, and remit" klicken
- Stripe Tax muss **deaktiviert** bleiben

### 2. Invoice Tax Information konfigurieren

**Navigation:** Stripe Dashboard > Settings > Invoices > Invoice tax information

#### Tax ID eintragen:

1. Klicken Sie auf **"ID type"** Dropdown
2. Wählen Sie: **"DE Tax ID"** (Deutsche Steuernummer)
3. Geben Sie Ihre Steuernummer ein, z.B.:
   ```
   Format (je nach Finanzamt):
   - 12/345/67890
   - 123/456/78901
   ```

**Wichtig:**
- **KEINE** USt-ID eintragen (haben Kleinunternehmer nicht)
- Nur Ihre persönliche **Steuernummer** vom Finanzamt

### 3. Default memo - § 19 UStG Hinweis (PFLICHT!)

**Navigation:** Stripe Dashboard > Settings > Invoices > Default memo

Tragen Sie folgenden Text ein:

```
Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
```

**Alternative Formulierungen:**
```
Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG.
```

Oder ausführlicher:
```
Als Kleinunternehmer im Sinne von § 19 Abs. 1 UStG wird Umsatzsteuer nicht berechnet.
```

**Warum wichtig?**
- Gesetzliche Pflicht nach § 19 Abs. 1 Satz 3 UStG
- Muss auf JEDER Rechnung stehen
- Fehlt der Hinweis, können Kunden Umsatzsteuer verlangen!

### 4. Default footer - Firmendaten

**Navigation:** Stripe Dashboard > Settings > Invoices > Default footer

```
[Ihr vollständiger Name oder Firmenname]
[Straße und Hausnummer]
[PLZ und Ort]

Steuernummer: [Ihre Steuernummer, z.B. 12/345/67890]
E-Mail: [Ihre Kontakt-Email]

Bankverbindung:
IBAN: [Ihre IBAN]
BIC: [Ihr BIC]
Bank: [Name Ihrer Bank]

Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
```

**Beispiel:**
```
Max Mustermann
Musterstraße 123
12345 Musterstadt

Steuernummer: 12/345/67890
E-Mail: max@echoscribe.de

Bankverbindung:
IBAN: DE12 3456 7890 1234 5678 90
BIC: ABCDEFGH
Bank: Musterbank

Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
```

### 5. Default item prices

**Navigation:** Stripe Dashboard > Settings > Invoices > Default item prices

Wählen Sie: **"Include inclusive tax"**

**Wichtig zu verstehen:**
- Ihre Preise sind **Bruttopreise** ohne MwSt
- €9.99 = €9.99 (kein MwSt-Anteil)
- €24.99 = €24.99 (kein MwSt-Anteil)
- €49.99 = €49.99 (kein MwSt-Anteil)

Da `ENABLE_STRIPE_TAX=false`, wird keine Steuer berechnet, auch wenn "inclusive" gewählt ist.

### 6. E-Mail-Vorlagen anpassen

**Navigation:** Stripe Dashboard > Settings > Emails > Invoice Email

#### Betreff:
```
Ihre Rechnung von EchoScribe - {{invoice.number}}
```

#### E-Mail-Text:
```
Guten Tag,

vielen Dank für Ihr Abonnement bei EchoScribe.

Anbei finden Sie Ihre Rechnung für den aktuellen Abrechnungszeitraum:

Rechnungsnummer: {{invoice.number}}
Rechnungsdatum: {{invoice.created}}
Betrag: {{invoice.total}} EUR

Hinweis: Als Kleinunternehmer gemäß § 19 UStG berechnen wir keine Umsatzsteuer.

Sie können Ihre Rechnung jederzeit in Ihrem Kundenbereich einsehen und herunterladen.

Bei Fragen zu Ihrer Rechnung oder Ihrem Abonnement stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr EchoScribe Team

---
[Ihr Name]
[Ihre E-Mail]
[Ihre Website]
```

### 7. Business Settings - Firmendaten

**Navigation:** Stripe Dashboard > Settings > Business settings

Füllen Sie **vollständig** aus:

```
Legal name: [Ihr vollständiger Name oder Firmenname]
Address: [Straße und Hausnummer]
Postal code: [PLZ]
City: [Ort]
Country: Germany

Tax ID: [Ihre Steuernummer]
```

**Nicht ausfüllen:**
- VAT ID: leer lassen (haben Kleinunternehmer nicht)
- Company registration number: nur wenn GmbH/UG

### 8. Customer Portal aktivieren

**Navigation:** Stripe Dashboard > Settings > Customer Portal

Aktivieren Sie:
- ✅ **Invoice history** - Kunden können Rechnungen einsehen
- ✅ **Download invoices** - PDF-Download
- ✅ **Update payment method**
- ✅ **Cancel subscription** (optional)

**Branding:**
- Logo hochladen (optional)
- Farben anpassen (optional)

### 9. Webhook Events konfigurieren

**Navigation:** Stripe Dashboard > Developers > Webhooks

#### Für Development (localhost):
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

#### Für Production:

1. **"Add endpoint"**
2. **Endpoint URL:** `https://ihre-domain.de/api/webhooks/stripe`
3. **Events auswählen:**
   - ✅ `checkout.session.completed`
   - ✅ `invoice.created`
   - ✅ `invoice.finalized`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

4. **Webhook Signing Secret** kopieren und in `.env` eintragen:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## 🧪 Testing

### Test-Checkliste:

1. **Test-Subscription erstellen**
   ```
   - Stripe Dashboard: Test Mode aktivieren
   - Testkarte: 4242 4242 4242 4242
   - CVV: beliebig (z.B. 123)
   - Datum: Zukunft (z.B. 12/26)
   ```

2. **Prüfen Sie die Checkout-Session**
   - ✅ Preis: €9.99, €24.99 oder €49.99
   - ✅ **KEINE** zusätzliche MwSt
   - ✅ Gesamtbetrag = Preis (kein Aufschlag)

3. **Rechnung prüfen**
   - Warten Sie ca. 1-2 Minuten
   - Gehen Sie zu: Dashboard > Settings > "Rechnungen & Zahlungen verwalten"
   - Laden Sie die PDF-Rechnung herunter

4. **PDF-Rechnung Checkliste:**
   ```
   ✅ Ihr vollständiger Name/Firmenname
   ✅ Ihre vollständige Adresse
   ✅ Ihre Steuernummer (NICHT USt-ID!)
   ✅ Rechnungsnummer (z.B. 1234-5678)
   ✅ Rechnungsdatum
   ✅ Leistungszeitraum
   ✅ Produktbeschreibung (z.B. "EchoScribe Professional")
   ✅ Betrag: €9.99, €24.99 oder €49.99
   ✅ KEINE Umsatzsteuer-Zeile
   ✅ KEIN MwSt-Ausweis (z.B. "€4.20 MwSt")
   ✅ Hinweis: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet"
   ✅ IBAN/Bankverbindung
   ```

5. **Firestore prüfen**
   - Firebase Console > Firestore > Collection `invoices`
   - Prüfen Sie ein Invoice-Dokument:
     ```
     ✅ tax: 0
     ✅ total: 999 (für €9.99) oder 2499 (für €24.99) - in Cents
     ✅ subtotal: 999 oder 2499 (gleich wie total)
     ```

### Fehlersuche

**Problem: Auf der Rechnung steht MwSt**
- Lösung: `ENABLE_STRIPE_TAX=false` in `.env` prüfen
- Lösung: App neu starten (`npm run dev`)
- Lösung: Stripe Tax im Dashboard NICHT aktiviert?

**Problem: Kein § 19 UStG Hinweis auf Rechnung**
- Lösung: Default memo im Stripe Dashboard eintragen
- Lösung: Default footer prüfen

**Problem: Rechnung zeigt "€0.00 VAT"**
- OK: Das ist in Ordnung, solange kein Steuerbetrag addiert wird
- Wichtig: Total = Subtotal (keine Steuer oben drauf)

## 📊 Beispiel-Rechnung (Kleinunternehmer)

```
═══════════════════════════════════════════════════════
              RECHNUNG
═══════════════════════════════════════════════════════

[Ihr Logo]

Max Mustermann
Musterstraße 123
12345 Musterstadt

Rechnung an:
Klaus Kunde
Kundenstraße 456
54321 Kundenstadt

Rechnungsnummer: 1234-5678
Rechnungsdatum: 31.10.2025
Leistungszeitraum: 01.11.2025 - 30.11.2025

───────────────────────────────────────────────────────
POSITION                                        BETRAG
───────────────────────────────────────────────────────
EchoScribe Professional                        €24.99
Monatliches Abonnement
60 Podcast-Analysen pro Monat

───────────────────────────────────────────────────────
                                    GESAMT:    €24.99
───────────────────────────────────────────────────────

Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.

═══════════════════════════════════════════════════════

Max Mustermann
Musterstraße 123
12345 Musterstadt

Steuernummer: 12/345/67890
E-Mail: max@echoscribe.de

Bankverbindung:
IBAN: DE12 3456 7890 1234 5678 90
BIC: ABCDEFGH
Bank: Musterbank

Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
```

## ⚖️ Rechtliche Hinweise

### Kleinunternehmerregelung § 19 UStG

**Voraussetzungen:**
- Umsatz im Vorjahr: maximal €22.000
- Umsatz im laufenden Jahr: voraussichtlich maximal €50.000

**Vorteile:**
- ✅ Keine Umsatzsteuer berechnen
- ✅ Keine Umsatzsteuervoranmeldung
- ✅ Keine Umsatzsteuererklärung
- ✅ Einfachere Buchhaltung

**Nachteile:**
- ❌ Kein Vorsteuerabzug
- ❌ Keine Umsatzsteuer auf eigenen Rechnungen (kann bei B2B-Kunden problematisch sein)

**Pflichten:**
- ✅ Hinweis auf § 19 UStG auf JEDER Rechnung
- ✅ Steuernummer auf Rechnung
- ✅ Einnahmen-Überschuss-Rechnung (EÜR)

### Was passiert, wenn Sie die €22.000 überschreiten?

**Im Jahr der Überschreitung:**
1. Sie werden umsatzsteuerpflichtig
2. Müssen rückwirkend ab 1. Januar Umsatzsteuer abführen
3. Müssen alle bisherigen Rechnungen korrigieren

**Empfehlung:**
- Ab €18.000 Umsatz: Freiwillig zur Regelbesteuerung wechseln
- Dann: `ENABLE_STRIPE_TAX=true` setzen
- Stripe Dashboard: Stripe Tax aktivieren
- Alle Konfigurationen anpassen

**Vorbereitung auf Wechsel:**
1. Umgebungsvariable ist bereits vorbereitet
2. Einfach `ENABLE_STRIPE_TAX=true` setzen
3. Stripe Tax im Dashboard aktivieren
4. § 19 UStG Hinweis aus Memo/Footer entfernen
5. USt-ID beantragen und eintragen

## 🔄 Wechsel zur Regelbesteuerung

Wenn Sie später umsatzsteuerpflichtig werden:

### 1. Steuerberater konsultieren
- Wann genau der Wechsel erfolgen muss
- Welche Formalitäten zu erledigen sind

### 2. USt-ID beantragen
- Beim Bundeszentralamt für Steuern
- Online unter www.bzst.de
- Dauert ca. 2-4 Wochen

### 3. Code-Änderung (sehr einfach!)
```typescript
// In app/api/stripe/create-checkout-session/route.ts (Zeile 60):
const enableStripeTax = true;  // Von false auf true ändern
```

### 4. Stripe Dashboard
- Stripe Tax aktivieren ("Start now")
- USt-ID statt Steuernummer eintragen
- § 19 UStG Hinweis aus Memo entfernen
- Footer aktualisieren (USt-ID statt Steuernummer)

### 5. Preise anpassen?
**Wichtig entscheiden:**

**Option A: Bruttopreise beibehalten**
- €24.99 Brutto bleiben €24.99
- Netto: €21.00, MwSt: €3.99
- Kunde zahlt gleich viel wie vorher
- Sie erhalten weniger (€21 statt €24.99)

**Option B: Nettopreise beibehalten**
- €24.99 wird zu €29.74 Brutto
- Netto: €24.99, MwSt: €4.75
- Kunde zahlt mehr
- Sie erhalten gleich viel wie vorher

**Empfehlung:** Option A für bestehende Kunden (Kundenbindung)

## 📁 Dokumente für Steuerberater

Bereiten Sie folgende Dokumente vor:

1. **Muster-Rechnung** (PDF aus Stripe)
2. **Stripe Dashboard Screenshots:**
   - Invoice Settings
   - Tax Configuration
   - Business Settings
3. **Umsatzübersicht:**
   - Export aus Stripe (CSV)
   - Monatliche Summen

**Fragen Sie Ihren Steuerberater:**
- Sind alle Pflichtangaben vorhanden?
- Ist der § 19 UStG Hinweis korrekt formuliert?
- Müssen zusätzliche Angaben auf die Rechnung?
- Wie erfolgt die Buchhaltung mit Stripe?

## ✅ Final Checklist

- [ ] `ENABLE_STRIPE_TAX=false` in allen .env Dateien
- [ ] Stripe Tax im Dashboard NICHT aktiviert
- [ ] Steuernummer (nicht USt-ID) hinterlegt
- [ ] Default memo mit § 19 UStG Hinweis
- [ ] Default footer mit vollständigen Firmendaten
- [ ] Default footer mit § 19 UStG Hinweis
- [ ] E-Mail-Vorlage mit § 19 UStG Hinweis
- [ ] Business Settings vollständig ausgefüllt
- [ ] Customer Portal aktiviert
- [ ] Webhooks konfiguriert
- [ ] Test-Subscription durchgeführt
- [ ] Test-Rechnung heruntergeladen und geprüft
- [ ] Keine MwSt auf Test-Rechnung
- [ ] § 19 UStG Hinweis auf Test-Rechnung vorhanden
- [ ] Muster-Rechnung an Steuerberater geschickt
- [ ] Steuerberater hat Rechnung geprüft ✓

## 📞 Support

Bei Fragen zur Kleinunternehmerregelung:
- Sprechen Sie mit Ihrem Steuerberater
- IHK: Kostenlose Erstberatung
- Finanzamt: Informationen zu § 19 UStG

Bei technischen Fragen zu Stripe:
- Stripe Support: https://support.stripe.com
- Stripe Docs: https://stripe.com/docs

---

**Status:** Code ✅ konfiguriert für Kleinunternehmer | Stripe Dashboard ⏳ Konfiguration erforderlich

Erstellt: 2025-10-31
