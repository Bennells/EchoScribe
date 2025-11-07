import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Allgemeine Geschäftsbedingungen (AGB)</h1>

      {/* Launch Phase Notice */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Launch Special Phase</p>
          <p>
            Während der Launch Special Phase ist nur der kostenlose Plan mit 200 Minuten verfügbar.
            Diese AGB werden nach der offiziellen Launch-Phase mit bezahlten Plänen aktualisiert.
          </p>
        </div>
      </div>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Geltungsbereich</h2>
          <p>
            Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung von EchoScribe,
            einem Service zur Umwandlung von Podcasts in Blog-Artikel.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Leistungsbeschreibung</h2>
          <p>
            EchoScribe bietet einen Service zur automatischen Umwandlung von Audio-Podcasts in
            SEO-optimierte Blog-Artikel mittels künstlicher Intelligenz (Google Gemini AI).
          </p>
          <h3 className="text-xl font-semibold mt-6 mb-3">2.1 Leistungsumfang</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Upload von Audio-Dateien (max. 500 MB)</li>
            <li>Automatische Transkription und Artikel-Generierung</li>
            <li>Bereitstellung in Markdown- und HTML-Format</li>
            <li>SEO-Optimierung (Meta-Descriptions, Keywords, Schema.org)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Nutzungsbedingungen</h2>
          <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Registrierung</h3>
          <p>
            Die Nutzung des Services erfordert eine Registrierung mit gültiger E-Mail-Adresse und
            Passwort.
          </p>
          <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Erlaubte Nutzung</h3>
          <p>Der Service darf nur für legale Zwecke genutzt werden. Verboten ist insbesondere:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Upload von urheberrechtlich geschütztem Material ohne Berechtigung</li>
            <li>Upload von illegalen, beleidigenden oder schädlichen Inhalten</li>
            <li>Missbrauch des Services (z.B. automatisierte Anfragen, DDoS)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Preise und Zahlung</h2>
          <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Free Tier</h3>
          <p>
            <strong>Während der Launch Special Phase:</strong> Der kostenlose Plan umfasst 200 Minuten
            Audio-Verarbeitung pro Monat. Diese Quota erneuert sich monatlich. Es werden keine Zahlungen
            verarbeitet und keine kostenpflichtigen Abonnements angeboten.
          </p>
          <p className="mt-3">
            <strong>Nach der Launch Special Phase:</strong> Der kostenlose Plan umfasst 100 Minuten
            Audio-Verarbeitung pro Monat mit monatlicher Erneuerung.
          </p>
          <h3 className="text-xl font-semibold mt-6 mb-3">4.2 Bezahlte Abos (Nach Launch Phase)</h3>
          <p>
            Nach Abschluss der Launch Special Phase werden bezahlte Abonnements mit erweiterten Quotas
            verfügbar sein. Diese werden über Stripe abgewickelt. Die Abrechnung erfolgt dann monatlich
            im Voraus. Bestehende Nutzer werden rechtzeitig über die Verfügbarkeit und Konditionen
            informiert.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Haftung</h2>
          <p>
            Die generierten Artikel werden automatisch durch KI erstellt. Wir übernehmen keine
            Garantie für die Richtigkeit, Vollständigkeit oder Qualität der Ergebnisse. Der Nutzer
            ist selbst für die Überprüfung und Verwendung der Artikel verantwortlich.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Datenschutz</h2>
          <p>
            Für die Verarbeitung personenbezogener Daten gilt unsere{" "}
            <Link href="/privacy" className="text-primary underline hover:no-underline">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Kündigung</h2>
          <p>
            Nutzer können ihr Konto jederzeit in den Einstellungen löschen. Bei bezahlten Abos
            endet die Leistung mit dem Ende der Abrechnungsperiode.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">8. Änderungen der AGB</h2>
          <p>
            Wir behalten uns vor, diese AGB jederzeit zu ändern. Nutzer werden über Änderungen per
            E-Mail informiert.
          </p>
        </section>

        <section className="mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            Stand: {new Date().toLocaleDateString("de-DE")}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <Link href="/" className="underline hover:text-primary">
              Zurück zur Startseite
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
