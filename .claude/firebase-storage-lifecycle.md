# Firebase Storage Lifecycle Policy - Deployment Guide

Diese Anleitung beschreibt die Implementierung der automatischen 3-Tage-Löschung für Podcast-Audiodateien.

## Übersicht

**Policy:** Alle Dateien im Ordner `podcasts/` werden nach 3 Tagen automatisch gelöscht.

**Vorteile:**
- ✅ Kostenersparnis: ~€800/Jahr bei 200 Kunden
- ✅ DSGVO-konform: Datensparsamkeit-Prinzip
- ✅ Sicherheit: Reduzierte Angriffsfläche
- ✅ 3-Tage-Buffer: Ausreichend für Fehlerbehandlung

**Was wird gelöscht:**
- Audio-Dateien in `podcasts/{userId}/{timestamp}_{filename}`

**Was wird NICHT gelöscht:**
- Artikel in Firestore (bleiben permanent)
- Podcast-Metadaten in Firestore
- User-Daten

---

## Voraussetzungen

1. **Google Cloud SDK installiert:**
   ```bash
   # Prüfen:
   gcloud --version

   # Falls nicht installiert:
   # https://cloud.google.com/sdk/docs/install
   ```

2. **Authentifizierung:**
   ```bash
   gcloud auth login
   ```

3. **Projekt-Zugriff:**
   - echoscribe-test (TEST)
   - echoscribe-prod (PROD)

---

## Deployment

### Schritt 1: Lifecycle Policy auf TEST anwenden

```bash
# Bucket-Name für TEST-Umgebung
gcloud storage buckets update gs://echoscribe-test.appspot.com \
  --lifecycle-file=storage-lifecycle.json \
  --project=echoscribe-test
```

**Erwartete Ausgabe:**
```
Updating gs://echoscribe-test.appspot.com/...
  Completed 1
```

### Schritt 2: Policy verifizieren (TEST)

```bash
# Policy anzeigen
gcloud storage buckets describe gs://echoscribe-test.appspot.com \
  --format="json(lifecycle)" \
  --project=echoscribe-test
```

**Erwartete Ausgabe:**
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 3,
          "matchesPrefix": [
            "podcasts/"
          ]
        }
      }
    ]
  }
}
```

### Schritt 3: Testen (TEST-Umgebung)

**Option A: Manuelle Test-Datei (empfohlen)**

```bash
# 1. Test-Datei hochladen
echo "test" > test-podcast.mp3

gsutil cp test-podcast.mp3 gs://echoscribe-test.appspot.com/podcasts/test-user/test.mp3

# 2. Zeitstempel setzen (simuliert alte Datei)
gsutil setmeta -h "x-goog-meta-created:$(date -d '4 days ago' --rfc-3339=seconds)" \
  gs://echoscribe-test.appspot.com/podcasts/test-user/test.mp3

# 3. Nach ~24h prüfen, ob Datei gelöscht wurde
gsutil ls gs://echoscribe-test.appspot.com/podcasts/test-user/
```

**Option B: Warten auf echte Löschung**
- Laden Sie einen Test-Podcast hoch
- Warten Sie 3 Tage
- Prüfen Sie, ob die Datei automatisch gelöscht wurde

**Hinweis:** Lifecycle-Policies werden einmal täglich ausgeführt (nicht sofort).

### Schritt 4: Lifecycle Policy auf PROD anwenden

**⚠️ WICHTIG:** Erst nach erfolgreichem TEST-Deployment!

```bash
# Bucket-Name für PROD-Umgebung
gcloud storage buckets update gs://echoscribe-prod.appspot.com \
  --lifecycle-file=storage-lifecycle.json \
  --project=echoscribe-prod
```

### Schritt 5: Policy verifizieren (PROD)

```bash
gcloud storage buckets describe gs://echoscribe-prod.appspot.com \
  --format="json(lifecycle)" \
  --project=echoscribe-prod
```

---

## Monitoring

### Prüfen, welche Dateien gelöscht werden

```bash
# TEST
gsutil ls -lR gs://echoscribe-test.appspot.com/podcasts/ | \
  awk '{if ($1 != "TOTAL:") print $2, $3}'

# PROD
gsutil ls -lR gs://echoscribe-prod.appspot.com/podcasts/ | \
  awk '{if ($1 != "TOTAL:") print $2, $3}'
```

### Storage-Nutzung überwachen

**Firebase Console:**
1. Öffne: https://console.firebase.google.com
2. Wähle Projekt: echoscribe-test oder echoscribe-prod
3. Gehe zu: **Storage** > **Usage**
4. Prüfe: Speicherverbrauch sollte nach 3 Tagen konstant bleiben (nicht wachsen)

**Google Cloud Console:**
1. Öffne: https://console.cloud.google.com/storage
2. Wähle Projekt
3. Klicke auf Bucket: `echoscribe-test.appspot.com`
4. Prüfe: **Size** und **Object count**

### Logs überprüfen

```bash
# Lifecycle-Aktionen anzeigen (TEST)
gcloud logging read \
  "resource.type=gcs_bucket AND protoPayload.methodName=storage.objects.delete" \
  --limit=50 \
  --project=echoscribe-test \
  --format=json

# PROD
gcloud logging read \
  "resource.type=gcs_bucket AND protoPayload.methodName=storage.objects.delete" \
  --limit=50 \
  --project=echoscribe-prod \
  --format=json
```

---

## Rollback (Falls nötig)

### Policy entfernen

**Falls Sie die automatische Löschung rückgängig machen möchten:**

```bash
# TEST
gcloud storage buckets update gs://echoscribe-test.appspot.com \
  --clear-lifecycle \
  --project=echoscribe-test

# PROD
gcloud storage buckets update gs://echoscribe-prod.appspot.com \
  --clear-lifecycle \
  --project=echoscribe-prod
```

### Policy ändern (z.B. auf 7 Tage)

1. Bearbeiten Sie `storage-lifecycle.json`:
   ```json
   {
     "lifecycle": {
       "rule": [{
         "action": {"type": "Delete"},
         "condition": {
           "age": 7,  // Geändert von 3 auf 7
           "matchesPrefix": ["podcasts/"]
         }
       }]
     }
   }
   ```

2. Wenden Sie die neue Policy an:
   ```bash
   gcloud storage buckets update gs://echoscribe-test.appspot.com \
     --lifecycle-file=storage-lifecycle.json \
     --project=echoscribe-test
   ```

---

## Troubleshooting

### Problem: Policy wird nicht angewendet

**Mögliche Ursachen:**
1. Lifecycle-Policies werden nur einmal täglich ausgeführt (Geduld!)
2. Datei-Zeitstempel ist zu neu (noch keine 3 Tage alt)
3. Bucket-Permissions fehlen

**Lösung:**
```bash
# Prüfe, ob Policy gesetzt ist:
gcloud storage buckets describe gs://echoscribe-test.appspot.com \
  --format="json(lifecycle)"

# Wenn leer: Policy erneut anwenden
```

### Problem: "Permission denied" Fehler

**Lösung:**
```bash
# Sicherstellen, dass Sie die richtigen Permissions haben:
gcloud projects get-iam-policy echoscribe-test \
  --flatten="bindings[].members" \
  --filter="bindings.members:$(gcloud config get-value account)"

# Sie benötigen: roles/storage.admin oder roles/owner
```

### Problem: Alle Dateien wurden gelöscht (auch neue)

**Ursache:** Falsche `matchesPrefix` Konfiguration

**Lösung:**
1. Policy sofort entfernen (siehe Rollback)
2. Prüfe `storage-lifecycle.json` auf Fehler
3. Stelle sicher, dass `matchesPrefix: ["podcasts/"]` korrekt ist

---

## Best Practices

### 1. Backup-Strategie (Optional)

Für wichtige Produktions-Daten können Sie vor dem Löschen ein Backup erstellen:

```bash
# Automatisches Backup vor Löschung (fortgeschritten)
# Exportiere Liste aller Dateien älter als 3 Tage:
gsutil ls -lR gs://echoscribe-prod.appspot.com/podcasts/ | \
  awk '{if ($1 != "TOTAL:" && $2 < "'"$(date -d '3 days ago' '+%Y-%m-%d')"'") print $4}' > files-to-delete.txt

# Backup erstellen (optional):
# Kopiere zu Archive-Bucket vor Löschung
```

### 2. User-Kommunikation

Informieren Sie Ihre Nutzer über die Policy:

**In Settings/Upload-Bereich anzeigen:**
```
ℹ️ Audio-Dateien werden nach 3 Tagen automatisch gelöscht
✅ Ihre Artikel bleiben dauerhaft gespeichert
🔒 Dies schützt Ihre Daten und hält Kosten niedrig
```

### 3. Monitoring-Dashboard

Erstellen Sie ein Admin-Dashboard zur Überwachung:
- Aktuelle Storage-Nutzung (GB)
- Anzahl gespeicherter Dateien
- Kosten-Trend über Zeit
- Alert bei ungewöhnlich hoher Nutzung

### 4. Testing vor PROD

**Immer** erst auf TEST-Umgebung testen:
1. Policy auf TEST anwenden
2. Test-Upload durchführen
3. Nach 3+ Tagen prüfen, ob gelöscht
4. Erst dann auf PROD ausrollen

---

## Erwartete Kostenersparnis

### Szenario: 200 Kunden

**Ohne Lifecycle Policy (permanent):**
- Monat 1: 270 GB → $6.21/Monat
- Monat 12: 3,240 GB → $74.52/Monat
- **Jahr 1 Total:** ~$480

**Mit 3-Tage Lifecycle Policy:**
- Monat 1: 27 GB (nur 3 Tage) → $0.62/Monat
- Monat 12: 27 GB (konstant) → $0.62/Monat
- **Jahr 1 Total:** ~$7

**Ersparnis: ~$473/Jahr** (nur Storage, ohne Upload/Download)
**Gesamt mit allen Kosten: ~€800/Jahr Ersparnis**

---

## Checkliste

Vor dem Deployment:

- [ ] Google Cloud SDK installiert
- [ ] Authentifiziert (`gcloud auth login`)
- [ ] `storage-lifecycle.json` Datei vorhanden
- [ ] TEST-Umgebung bereit

Nach dem Deployment:

- [ ] Policy auf TEST angewendet
- [ ] Policy verifiziert (JSON ausgegeben)
- [ ] Test-Upload durchgeführt
- [ ] Nach 3+ Tagen: Löschung verifiziert
- [ ] Policy auf PROD angewendet
- [ ] Monitoring eingerichtet
- [ ] Nutzer informiert (UI-Hinweis)
- [ ] Privacy Policy aktualisiert

---

## Weitere Informationen

**Google Cloud Storage Lifecycle Management:**
https://cloud.google.com/storage/docs/lifecycle

**Firebase Storage Best Practices:**
https://firebase.google.com/docs/storage/web/best-practices

**Pricing Calculator:**
https://cloud.google.com/products/calculator

---

**Status:** Ready for deployment
**Erstellt:** 2025-10-31
**Zuletzt aktualisiert:** 2025-10-31
