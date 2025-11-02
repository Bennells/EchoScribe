# Stripe Tax & Rechnungsstellung - Konfigurationsanleitung

Diese Anleitung beschreibt alle notwendigen Schritte zur Konfiguration von Stripe Tax und automatischer Rechnungsstellung im Stripe Dashboard.

## ✅ Code-Änderungen (Bereits implementiert)

- ✅ API Version auf `2024-11-20.acacia` aktualisiert
- ✅ `automatic_tax`, `customer_update` und `tax_id_collection` in Checkout Session aktiviert
- ✅ Neue Webhook-Handler für `invoice.created`, `invoice.finalized`, `invoice.payment_failed`
- ✅ Firestore `invoices` Collection für Rechnungs-Tracking
- ✅ UI-Card "Rechnungen & Zahlungen" im Settings-Bereich

## 📋 Stripe Dashboard Konfiguration (Erforderlich)

### 1. Stripe Tax aktivieren

**Navigation:** Stripe Dashboard > Settings > Tax

1. Klicken Sie auf **"Enable Stripe Tax"**
2. Wählen Sie **"Germany"** als Geschäftssitz
3. Geben Sie Ihre **deutsche USt-ID** ein (Format: DE123456789)
4. Bestätigen Sie die Aktivierung

**Wichtig:**
- Sie benötigen eine gültige deutsche Umsatzsteuer-Identifikationsnummer
- Falls Sie Kleinunternehmer nach § 19 UStG sind, müssen Sie dies separat konfigurieren

### 2. Firmendaten konfigurieren

**Navigation:** Stripe Dashboard > Settings > Business Settings

Tragen Sie folgende Pflichtangaben ein:

```
Firmendaten (Beispiel):
- Legal Business Name: [Ihr Firmenname GmbH]
- Straße: [Musterstraße 123]
- PLZ: [12345]
- Ort: [Musterstadt]
- Land: Deutschland
- USt-IdNr.: [DE123456789]
- Handelsregister: [HRB 12345, Amtsgericht Musterstadt]
- Geschäftsführer: [Name]
```

**Warum wichtig?**
Diese Daten erscheinen auf allen Rechnungen und sind nach § 14 UStG Pflichtangaben.

### 3. Rechnungsvorlagen anpassen

**Navigation:** Stripe Dashboard > Settings > Invoices

#### 3.1 Logo hochladen
- Laden Sie Ihr Firmenlogo hoch (empfohlen: PNG, max. 5 MB)
- Format: Mindestens 150px Höhe für gute Qualität

#### 3.2 Rechnungs-Footer konfigurieren

Fügen Sie im Footer-Bereich folgende Pflichtangaben hinzu:

```
[Ihr Firmenname]
[Straße und Hausnummer]
[PLZ und Ort]

Geschäftsführer: [Name]
Handelsregister: [HRB-Nummer] [Registergericht]
USt-IdNr.: [DE123456789]

Bankverbindung:
IBAN: [DE12 3456 7890 1234 5678 90]
BIC: [ABCDEFGH]
Bank: [Name der Bank]

Kleinbetragsrechnungen bis 250€ enthalten vereinfachte Angaben gemäß § 33 UStDV.
```

#### 3.3 Memo-Feld (Optional)

Für zusätzliche rechtliche Hinweise:

**Für Normalbesteuerer:**
```
Alle Preise verstehen sich inklusive der gesetzlichen Umsatzsteuer.
Umsatzsteuer gemäß § 14 UStG ausgewiesen.
```

**Für Kleinunternehmer (§ 19 UStG):**
```
Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
```

### 4. E-Mail-Vorlagen anpassen (Deutsch)

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
Betrag: {{invoice.total}} {{invoice.currency}}

Sie können Ihre Rechnung jederzeit in Ihrem Kundenbereich einsehen und herunterladen:
[Link zum Kundenportal]

Bei Fragen zu Ihrer Rechnung oder Ihrem Abonnement stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
Ihr EchoScribe Team

---
[Ihr Firmenname]
[Kontakt-E-Mail]
[Website]
```

### 5. Customer Portal konfigurieren

**Navigation:** Stripe Dashboard > Settings > Customer Portal

Aktivieren Sie folgende Funktionen:

- ✅ **Invoice history** - Kunden können alle Rechnungen einsehen
- ✅ **Download invoices** - PDF-Download aktivieren
- ✅ **Update payment method** - Zahlungsmethode ändern
- ✅ **Cancel subscription** - Abo kündigen (optional)

**Branding:**
- Logo hochladen (gleiches wie bei Rechnungen)
- Farben Ihrer Marke einstellen
- Icon/Favicon hochladen

### 6. Webhook-Endpoints konfigurieren

**Navigation:** Stripe Dashboard > Developers > Webhooks

#### Für Development (localhost):
Nutzen Sie die Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

#### Für Production:

1. Klicken Sie auf **"Add endpoint"**
2. Endpoint URL: `https://[ihre-domain]/api/webhooks/stripe`
3. Wählen Sie folgende Events:

**Erforderliche Events:**
- ✅ `checkout.session.completed`
- ✅ `invoice.created`
- ✅ `invoice.finalized`
- ✅ `invoice.paid`
- ✅ `invoice.payment_succeeded`
- ✅ `invoice.payment_failed`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

4. Speichern Sie den **Webhook Signing Secret** als Environment Variable:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 7. Preise prüfen (Brutto vs. Netto)

**Navigation:** Stripe Dashboard > Products

Prüfen Sie Ihre Produktpreise:

**Aktuell (vermutlich):**
- Starter: €9.99
- Professional: €24.99
- Business: €49.99

**Wichtige Frage:** Sind das Brutto- oder Nettopreise?

**Empfehlung für B2C (Endkunden):**
- Preise als **Brutto** (inkl. MwSt.) definieren
- In Stripe: Tax behavior = "Inclusive"
- Beispiel: €24.99 Brutto = €21.00 Netto + €3.99 MwSt (19%)

**Für B2B (Geschäftskunden):**
- Preise als **Netto** definieren
- In Stripe: Tax behavior = "Exclusive"
- MwSt wird oben drauf gerechnet
- Beispiel: €24.99 Netto + €4.75 MwSt = €29.74 Brutto

**Konfiguration anpassen:**
1. Gehen Sie zu Ihren Produkten im Stripe Dashboard
2. Bearbeiten Sie jeden Preis
3. Setzen Sie "Tax behavior" auf:
   - **Inclusive** für Bruttopreise (empfohlen für B2C)
   - **Exclusive** für Nettopreise (für B2B)

## 🧪 Testing (Wichtig vor Production!)

### Test-Checkliste:

1. **Test-Subscription erstellen**
   - Nutzen Sie Stripe Test Mode
   - Testkarte: `4242 4242 4242 4242`
   - CVV: beliebig, Datum: Zukunft

2. **Adresse eingeben**
   - Testen Sie mit deutscher Adresse
   - Prüfen Sie, ob 19% MwSt berechnet wird

3. **Rechnung prüfen**
   - Warten Sie, bis `invoice.finalized` Event kommt
   - Laden Sie PDF herunter
   - Prüfen Sie alle Pflichtangaben:
     - ✅ Vollständige Firmenanschrift
     - ✅ USt-ID
     - ✅ Rechnungsnummer (fortlaufend)
     - ✅ Rechnungsdatum
     - ✅ Leistungszeitraum
     - ✅ Nettobetrag
     - ✅ MwSt-Satz (19%)
     - ✅ MwSt-Betrag
     - ✅ Bruttobetrag

4. **Customer Portal testen**
   - Öffnen Sie `/dashboard/settings`
   - Klicken Sie auf "Rechnungen & Zahlungen verwalten"
   - Prüfen Sie:
     - ✅ Rechnungsliste sichtbar
     - ✅ PDF-Download funktioniert
     - ✅ Zahlungsmethode änderbar

5. **Webhook-Logs prüfen**
   ```bash
   # In Terminal
   stripe listen --forward-to localhost:3000/api/webhooks/stripe

   # Testzahlung auslösen und Events beobachten
   ```

6. **Firestore prüfen**
   - Öffnen Sie Firebase Console
   - Collection `invoices` sollte Einträge haben
   - Prüfen Sie Felder: invoiceId, invoiceNumber, total, tax, status

## 📊 Test-Szenarien

### Szenario 1: Deutscher B2C-Kunde (Standardfall)
```
Eingabe:
- Adresse: Deutschland
- Keine USt-ID

Erwartung:
- 19% MwSt wird berechnet
- Rechnung zeigt: Netto + 19% MwSt = Brutto
- Status: "paid" in Firestore
```

### Szenario 2: Deutscher B2B-Kunde
```
Eingabe:
- Adresse: Deutschland
- USt-ID: DE123456789 (Test-ID)

Erwartung:
- 19% MwSt wird trotzdem berechnet (kein Reverse Charge innerhalb DE)
- Rechnung zeigt USt-ID des Kunden
```

### Szenario 3: EU B2B-Kunde mit gültiger USt-ID
```
Eingabe:
- Adresse: Frankreich
- USt-ID: FR12345678901 (Test-ID)

Erwartung:
- 0% MwSt (Reverse Charge)
- Rechnung enthält Hinweis auf Reverse Charge
- Hinweis: "Steuerschuldnerschaft des Leistungsempfängers"
```

### Szenario 4: EU B2C-Kunde
```
Eingabe:
- Adresse: Frankreich
- Keine USt-ID

Erwartung:
- Französische MwSt wird angewendet (20%)
- Stripe Tax berechnet automatisch korrekt
```

## 🚀 Production Deployment

### Vor dem Go-Live:

1. **Environment Variables prüfen:**
   ```env
   STRIPE_SECRET_KEY=sk_live_... (Live Key!)
   STRIPE_WEBHOOK_SECRET=whsec_... (Production Webhook Secret)
   STRIPE_PRICE_ID_STARTER_MONTHLY=price_...
   STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_...
   STRIPE_PRICE_ID_BUSINESS_MONTHLY=price_...
   ```

2. **Stripe Live Mode aktivieren:**
   - Schalten Sie im Dashboard von Test auf Live
   - Stripe Tax ERNEUT im Live-Mode aktivieren
   - Alle Konfigurationen (Firmendaten, E-Mails, etc.) erneut prüfen

3. **Webhooks für Production:**
   - Production Endpoint hinzufügen
   - Events aktivieren (siehe oben)
   - Webhook Secret speichern

4. **Erste Test-Transaktion:**
   - Erstellen Sie eine echte Test-Subscription (1€)
   - Prüfen Sie die generierte Rechnung
   - Bei Problemen: Sofort stoppen und korrigieren

5. **Monitoring aktivieren:**
   - Stripe Dashboard > Logs beobachten
   - Firebase Console > Firestore > invoices Collection
   - Sentry/Error-Logging prüfen

### Nach Go-Live:

1. **Erste Rechnungen prüfen:**
   - Die ersten 5-10 Rechnungen manuell kontrollieren
   - Bei Fehlern: Kunden kontaktieren, korrigierte Rechnung nachreichen

2. **Steuerberater informieren:**
   - Zeigen Sie Ihrem Steuerberater eine Muster-Rechnung
   - Lassen Sie die Pflichtangaben prüfen
   - Klären Sie die Buchhaltungs-Integration

3. **Dokumentation für Kunden:**
   - Erstellen Sie eine FAQ zu Rechnungen
   - Erklären Sie, wo Kunden ihre Rechnungen finden
   - Support-E-Mail für Rechnungsfragen bereitstellen

## 📞 Support & Troubleshooting

### Häufige Probleme:

**Problem: MwSt wird nicht berechnet**
- Lösung: Prüfen Sie, ob Stripe Tax im Live-Mode aktiviert ist
- Prüfen Sie, ob `automatic_tax: true` im Code gesetzt ist

**Problem: Rechnung enthält nicht alle Pflichtangaben**
- Lösung: Settings > Business Settings vollständig ausfüllen
- Footer-Text in Invoice Settings anpassen

**Problem: Webhooks kommen nicht an**
- Lösung: Webhook-Endpoint URL prüfen
- Webhook Secret korrekt in .env?
- Logs in Stripe Dashboard > Webhooks > [Endpoint] > Events prüfen

**Problem: Customer Portal zeigt keine Rechnungen**
- Lösung: "Invoice history" in Customer Portal Settings aktivieren
- Mindestens eine Rechnung muss existieren

**Problem: Falsche MwSt-Sätze bei EU-Kunden**
- Lösung: Stripe Tax berechnet automatisch korrekt
- Falls nicht: Tax-Registrierung in anderen EU-Ländern erforderlich (OSS)

### Hilfreiche Links:

- Stripe Tax Docs: https://stripe.com/docs/tax
- Stripe Invoicing: https://stripe.com/docs/invoicing
- German Tax Guide: https://stripe.com/guides/invoicing-best-practices-for-germany
- Customer Portal: https://stripe.com/docs/customer-management/customer-portal

## ✅ Final Checklist vor Production

- [ ] Stripe Tax im Live-Mode aktiviert
- [ ] Vollständige Firmendaten hinterlegt (Name, Adresse, USt-ID, HRB)
- [ ] Logo hochgeladen
- [ ] Rechnungs-Footer mit Bankdaten und Pflichtangaben
- [ ] E-Mail-Vorlagen auf Deutsch angepasst
- [ ] Customer Portal aktiviert und konfiguriert
- [ ] Webhooks für Production-Endpoint eingerichtet
- [ ] Alle 8 Events aktiviert
- [ ] Webhook Secret als STRIPE_WEBHOOK_SECRET gespeichert
- [ ] Test-Subscription durchgeführt und Rechnung geprüft
- [ ] Tax behavior (Inclusive/Exclusive) korrekt gesetzt
- [ ] Erste echte Rechnung von Steuerberater geprüft
- [ ] Code deployed (mit allen Änderungen aus diesem PR)
- [ ] Firestore Security Rules für `invoices` Collection gesetzt
- [ ] Monitoring aktiv (Stripe Logs, Firebase Logs, Sentry)

## 💰 Kosten

**Stripe Tax:**
- 0,5% pro Transaktion zusätzlich zu Stripe-Gebühren
- Beispiel: €24.99 Subscription = ~€0.12 Tax-Gebühr
- **Vorteil:** Vollautomatische Compliance, keine manuelle USt-Berechnung

**Gesamtkosten pro Transaktion:**
- Stripe-Gebühr: 1.4% + €0.25
- Stripe Tax: 0.5%
- Beispiel €24.99: ~€0.60 Gebühren total

## 🔐 Firestore Security Rules (Wichtig!)

Fügen Sie folgende Rules für die `invoices` Collection hinzu:

```javascript
// firestore.rules
match /invoices/{invoiceId} {
  // Nur der zugehörige User darf seine Rechnungen lesen
  allow read: if request.auth != null &&
    (request.auth.uid == resource.data.userId ||
     exists(/databases/$(database)/documents/subscriptions/$(resource.data.subscriptionId)) &&
     get(/databases/$(database)/documents/subscriptions/$(resource.data.subscriptionId)).data.userId == request.auth.uid);

  // Nur Server darf schreiben (via Firebase Admin SDK)
  allow write: if false;
}
```

## 📝 Nächste Schritte nach Implementierung

1. **Sofort:** Stripe Dashboard konfigurieren (siehe Abschnitte 1-6)
2. **Heute:** Testen im Test-Mode (siehe Test-Checkliste)
3. **Diese Woche:** Muster-Rechnung von Steuerberater prüfen lassen
4. **Vor Launch:** Production Deployment durchführen
5. **Nach Launch:** Erste Rechnungen manuell kontrollieren
6. **Optional (2028):** E-Rechnung (XRechnung/ZUGFeRD) für B2B-Kunden

---

**Status:** Code-Änderungen ✅ implementiert | Stripe Dashboard ⏳ Konfiguration erforderlich

Erstellt: 2025-10-31
Zuletzt aktualisiert: 2025-10-31
