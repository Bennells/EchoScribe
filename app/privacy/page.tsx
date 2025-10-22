import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Datenschutzerklärung</h1>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Datenschutz auf einen Blick</h2>
          <h3 className="text-xl font-semibold mt-6 mb-3">Allgemeine Hinweise</h3>
          <p>
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
            personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene
            Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Datenerfassung</h2>
          <h3 className="text-xl font-semibold mt-6 mb-3">Welche Daten erfassen wir?</h3>
          <p>Wir erfassen folgende Daten:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>E-Mail-Adresse (bei Registrierung)</li>
            <li>Hochgeladene Audio-Dateien (Podcasts)</li>
            <li>Generierte Blog-Artikel</li>
            <li>Nutzungsstatistiken (Anzahl Uploads, Quota-Verbrauch)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Firebase & Google Cloud</h2>
          <p>
            Diese Website nutzt Firebase von Google für Authentifizierung, Datenbank und
            Datei-Speicherung. Ihre Daten werden auf Servern von Google in der EU gespeichert.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Google Gemini AI</h2>
          <p>
            Zur Verarbeitung Ihrer Podcasts nutzen wir Google Gemini AI. Die Audio-Dateien werden
            an Google-Server übertragen, verarbeitet und die Ergebnisse zurückgesendet. Google
            speichert diese Daten nicht dauerhaft.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Ihre Rechte</h2>
          <p>Sie haben folgende Rechte:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Auskunft über Ihre gespeicherten Daten</li>
            <li>Berichtigung unrichtiger Daten</li>
            <li>Löschung Ihrer Daten</li>
            <li>Einschränkung der Verarbeitung</li>
            <li>Datenübertragbarkeit</li>
            <li>Widerspruch gegen die Verarbeitung</li>
          </ul>
          <p className="mt-4">
            Zur Ausübung Ihrer Rechte oder bei Fragen zum Datenschutz kontaktieren Sie uns bitte.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Datenlöschung</h2>
          <p>
            Sie können Ihr Konto jederzeit in den Einstellungen löschen. Dabei werden alle Ihre
            Daten (E-Mail, Podcasts, Artikel) unwiderruflich gelöscht.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Cookies</h2>
          <p>
            Diese Website verwendet ausschließlich technisch notwendige Cookies für die
            Authentifizierung. Diese sind für die Funktion der Website erforderlich.
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
