# Privacy Policy Update - Audio File Retention

Diese Vorlage enthält den Text für die Datenschutzerklärung bezüglich der 3-Tage-Speicherung von Audio-Dateien.

## Deutsch (für deutsche Nutzer)

### Speicherung von Audio-Dateien

**Hochgeladene Podcast-Dateien:**

Wenn Sie eine Podcast-Audio-Datei zu EchoScribe hochladen, wird diese Datei für einen Zeitraum von **3 Tagen** in unserem System gespeichert. Nach Ablauf dieser Frist wird die Audio-Datei automatisch und unwiderruflich gelöscht.

**Zweck der Speicherung:**
- Verarbeitung Ihrer Audio-Datei zur Erstellung des Blog-Artikels
- Fehlerbehandlung und Wiederholungsversuche bei technischen Problemen
- Möglichkeit zur erneuten Verarbeitung innerhalb von 3 Tagen

**Dauerhaft gespeicherte Daten:**
- Ihr generierter Blog-Artikel (Text, HTML, Metadaten)
- Podcast-Metadaten (Titel, Upload-Datum, Status)
- Ihr Benutzerkonto und Abonnement-Informationen

**Löschung:**
Audio-Dateien werden nach 3 Tagen automatisch durch unsere Speicher-Richtlinien (Lifecycle Policy) gelöscht. Diese Löschung erfolgt automatisch und kann nicht rückgängig gemacht werden.

**Ihre Rechte:**
Gemäß DSGVO Art. 17 (Recht auf Löschung) können Sie jederzeit die sofortige Löschung Ihrer Audio-Dateien beantragen, auch vor Ablauf der 3-Tage-Frist. Kontaktieren Sie uns dazu unter: [support@echoscribe.de]

**Datensicherheit:**
Ihre Audio-Dateien werden verschlüsselt in Google Cloud Storage (Region: Europa) gespeichert und sind nur für autorisierte Verarbeitungsprozesse zugänglich.

---

### Englisch (für internationale Nutzer)

**Storage of Audio Files:**

When you upload a podcast audio file to EchoScribe, the file is stored in our system for a period of **3 days**. After this period expires, the audio file is automatically and permanently deleted.

**Purpose of Storage:**
- Processing your audio file to create the blog article
- Error handling and retry attempts in case of technical issues
- Ability to reprocess within 3 days if needed

**Permanently Stored Data:**
- Your generated blog article (text, HTML, metadata)
- Podcast metadata (title, upload date, status)
- Your user account and subscription information

**Deletion:**
Audio files are automatically deleted after 3 days through our storage lifecycle policies. This deletion is automatic and cannot be reversed.

**Your Rights:**
Under GDPR Art. 17 (Right to Erasure), you may request immediate deletion of your audio files at any time, even before the 3-day period expires. Contact us at: [support@echoscribe.de]

**Data Security:**
Your audio files are stored encrypted in Google Cloud Storage (Region: Europe) and are only accessible to authorized processing systems.

---

## DSGVO-Konformität

### Art. 5 Abs. 1 lit. c DSGVO - Datenminimierung

Die 3-Tage-Speicherung erfüllt das Prinzip der Datenminimierung:
- **Zweckbindung:** Daten werden nur so lange gespeichert, wie für die Verarbeitung notwendig
- **Speicherbegrenzung:** Automatische Löschung nach Zweckerfüllung
- **Verhältnismäßigkeit:** 3 Tage sind angemessen für Fehlerbehandlung

### Art. 13 DSGVO - Informationspflichten

Die folgenden Informationen müssen in der Datenschutzerklärung enthalten sein:

1. ✅ **Zweck der Verarbeitung:** Erstellung von Blog-Artikeln aus Audio
2. ✅ **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
3. ✅ **Speicherdauer:** 3 Tage für Audio-Dateien
4. ✅ **Empfänger:** Google Cloud Storage (Auftragsverarbeiter)
5. ✅ **Betroffenenrechte:** Auskunft, Löschung, Widerspruch, etc.
6. ✅ **Speicherort:** EU (Google Cloud europe-west1/europe-west3)

### Art. 28 DSGVO - Auftragsverarbeitung

**Auftragsverarbeiter:** Google Cloud Platform
**Vertrag:** Google Cloud Data Processing Agreement (DPA)
**Zertifizierung:** ISO 27001, SOC 2, ISO 27017, ISO 27018

**Hinweis für Privacy Policy:**
```
Wir nutzen Google Cloud Storage zur Speicherung Ihrer Audio-Dateien.
Google Cloud ist nach ISO 27001 zertifiziert und hat einen
Auftragsverarbeitungsvertrag (AVV) mit uns abgeschlossen.
```

---

## Auftragsverarbeitungsvertrag (AVV)

### Für B2B-Kunden (falls relevant)

Wenn Ihre Business-Tier-Kunden selbst Verantwortliche im Sinne der DSGVO sind, benötigen diese möglicherweise einen AVV mit Ihnen.

**Muster-AVV-Klausel:**

```
§ 3 Art und Zweck der Verarbeitung

Der Auftragnehmer (EchoScribe) verarbeitet personenbezogene Daten
(Audio-Dateien, Artikel-Inhalte) im Auftrag des Auftraggebers
ausschließlich zum Zweck der Erstellung von Blog-Artikeln aus
Podcast-Audio-Dateien.

§ 4 Speicherdauer

Audio-Dateien werden für maximal 3 Tage gespeichert und anschließend
automatisch gelöscht. Generierte Artikel werden dauerhaft gespeichert,
sofern der Auftraggeber keine Löschung verlangt.

§ 5 Technische und organisatorische Maßnahmen (TOM)

- Verschlüsselte Speicherung in Google Cloud Storage
- Zugriffskontrolle über Firebase Authentication
- Automatische Löschung nach 3 Tagen (Lifecycle Policy)
- Backup- und Wiederherstellungsprozesse
- Regelmäßige Sicherheitsaudits
```

---

## UI-Texte für Nutzer-Information

### In Settings-Seite

```typescript
<Card>
  <CardHeader>
    <CardTitle>Datenspeicherung</CardTitle>
    <CardDescription>
      Informationen zur Speicherung Ihrer Daten
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
      <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Audio-Dateien</p>
        <p className="text-sm text-muted-foreground">
          Ihre hochgeladenen Podcast-Dateien werden für 3 Tage gespeichert
          und anschließend automatisch gelöscht.
        </p>
      </div>
    </div>

    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
      <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Artikel</p>
        <p className="text-sm text-muted-foreground">
          Ihre generierten Blog-Artikel bleiben dauerhaft gespeichert,
          bis Sie diese löschen.
        </p>
      </div>
    </div>

    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md">
      <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Datenschutz</p>
        <p className="text-sm text-muted-foreground">
          Alle Daten werden verschlüsselt in der EU (Google Cloud) gespeichert
          und sind DSGVO-konform geschützt.
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

### Bei Upload (Tooltip/Info)

```typescript
<div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Info className="h-4 w-4" />
  <span>
    Audio wird nach Verarbeitung für 3 Tage gespeichert,
    dann automatisch gelöscht
  </span>
</div>
```

### Im Upload-Dialog

```typescript
<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Speicherhinweis</AlertTitle>
  <AlertDescription>
    Ihre Audio-Datei wird für 3 Tage gespeichert und dann automatisch gelöscht.
    Der generierte Artikel bleibt dauerhaft verfügbar.
  </AlertDescription>
</Alert>
```

---

## FAQ für Nutzer

**F: Warum werden meine Audio-Dateien gelöscht?**
A: Aus Datenschutz- und Kostengründen speichern wir Audio-Dateien nur temporär. Ihr Artikel bleibt dauerhaft erhalten.

**F: Kann ich meine Audio-Datei nach 3 Tagen noch herunterladen?**
A: Nein, nach 3 Tagen ist die Audio-Datei unwiderruflich gelöscht. Laden Sie sie vorher herunter, falls benötigt.

**F: Was passiert, wenn die Verarbeitung fehlschlägt?**
A: Sie haben 3 Tage Zeit, um die Verarbeitung erneut zu starten. Danach müssen Sie die Datei neu hochladen.

**F: Werden meine Artikel auch gelöscht?**
A: Nein! Ihre generierten Artikel bleiben dauerhaft gespeichert, bis Sie diese manuell löschen.

**F: Wo werden meine Daten gespeichert?**
A: Alle Daten werden verschlüsselt in Google Cloud Storage in europäischen Rechenzentren gespeichert (DSGVO-konform).

**F: Kann ich die Löschung verhindern?**
A: Als Business-Tier-Kunde können wir optional eine längere Speicherdauer anbieten. Kontaktieren Sie uns für Details.

---

## Checkliste für Datenschutzerklärung

- [ ] Zweck der Audio-Speicherung genannt
- [ ] Speicherdauer (3 Tage) klar kommuniziert
- [ ] Automatische Löschung erklärt
- [ ] Unterschied Audio vs. Artikel klargestellt
- [ ] Rechtsgrundlage genannt (Art. 6 Abs. 1 lit. b DSGVO)
- [ ] Speicherort genannt (EU, Google Cloud)
- [ ] Auftragsverarbeiter genannt (Google)
- [ ] Betroffenenrechte aufgelistet
- [ ] Kontaktmöglichkeit für Löschung angegeben
- [ ] DSGVO-konforme Formulierungen verwendet

---

## Rechtlicher Hinweis

**Disclaimer:** Diese Vorlage dient als Orientierung und ersetzt keine Rechtsberatung.
Lassen Sie Ihre finale Datenschutzerklärung von einem Fachanwalt für IT-Recht prüfen.

**Empfohlene Anwälte/Services:**
- IT-Recht Kanzlei München (spezialisiert auf SaaS)
- eRecht24 (Datenschutz-Generator)
- Trusted Shops Rechtstexter

**Kosten:** ~€200-500 für einmalige Prüfung/Anpassung

---

**Erstellt:** 2025-10-31
**Zuletzt aktualisiert:** 2025-10-31
**DSGVO-Version:** Stand Januar 2025
