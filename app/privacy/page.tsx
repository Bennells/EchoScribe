import Link from "next/link";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Datenschutzerklärung - EchoScribe",
  description: "Datenschutzerklärung für EchoScribe. EU-Hosting mit KI-Verarbeitung durch OpenAI (USA).",
  path: "/privacy",
  noIndex: true,
});

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
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Hosting und Infrastruktur (EU)</h2>
          <p>
            Diese Website nutzt Firebase von Google für Authentifizierung, Datenbank und
            Datei-Speicherung. <strong>Alle Ihre Daten (Account-Daten, Audio-Dateien, generierte
            Artikel) werden ausschließlich auf Servern von Google in der EU gespeichert.</strong>
          </p>
          <p className="mt-2">
            Verwendete Services mit EU-Hosting:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Firebase Authentication (Benutzer-Authentifizierung)</li>
            <li>Cloud Firestore (Datenbank)</li>
            <li>Cloud Storage (Datei-Speicherung)</li>
            <li>Firebase App Hosting (Webserver)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. KI-Verarbeitung durch OpenAI (USA)</h2>
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
            <p className="font-semibold text-yellow-900">Wichtiger Hinweis zur Datenverarbeitung:</p>
            <p className="text-yellow-800 mt-2">
              Für die KI-gestützte Verarbeitung Ihrer Audio-Dateien verwenden wir die OpenAI API
              (ChatGPT). Diese Verarbeitung erfolgt auf Servern von OpenAI in den USA.
            </p>
          </div>

          <h3 className="text-xl font-semibold mt-6 mb-3">Ablauf der Verarbeitung:</h3>
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>EU:</strong> Sie laden Ihre Audio-Datei auf unsere Server in der EU hoch</li>
            <li><strong>USA:</strong> Die Audio-Datei wird zur Verarbeitung an OpenAI-Server in den USA übertragen</li>
            <li><strong>USA:</strong> OpenAI erstellt Transkript und Blog-Artikel</li>
            <li><strong>EU:</strong> Die Ergebnisse werden zurück auf unsere EU-Server übertragen und dort gespeichert</li>
            <li><strong>Automatische Löschung:</strong> Die Original-Audio-Datei wird nach 30 Tagen automatisch aus unserem EU-Storage gelöscht</li>
          </ol>

          <h3 className="text-xl font-semibold mt-6 mb-3">Datenschutz bei OpenAI:</h3>
          <p>
            Wir nutzen die <strong>OpenAI API mit Zero Data Retention</strong>. Das bedeutet:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>OpenAI speichert Ihre Daten <strong>nicht dauerhaft</strong></li>
            <li>Ihre Daten werden <strong>nicht für Training</strong> der KI-Modelle verwendet</li>
            <li>Die Daten werden nur zur Verarbeitung Ihrer Anfrage verwendet und danach gelöscht</li>
            <li>OpenAI hat strenge Datenschutzrichtlinien gemäß ihrer Privacy Policy</li>
          </ul>

          <p className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <strong>Rechtsgrundlage:</strong> Die Datenübermittlung in die USA erfolgt auf Basis Ihrer
            Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) durch Nutzung des Services. Sie können dieser
            Verarbeitung jederzeit widersprechen, indem Sie den Service nicht mehr nutzen.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Ihre Rechte nach DSGVO</h2>
          <p>
            Gemäß der Datenschutz-Grundverordnung (DSGVO) haben Sie umfassende Rechte bezüglich
            Ihrer personenbezogenen Daten:
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Recht auf Auskunft (Art. 15 DSGVO)</h3>
          <p>
            Sie haben das Recht, jederzeit Auskunft über alle Ihre bei uns gespeicherten
            personenbezogenen Daten zu erhalten. Dies umfasst:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Welche Daten wir über Sie speichern</li>
            <li>Zu welchem Zweck diese Daten verarbeitet werden</li>
            <li>An wen Ihre Daten weitergegeben werden</li>
            <li>Wie lange Ihre Daten gespeichert werden</li>
          </ul>
          <p className="mt-4">
            <strong>So nutzen Sie Ihr Auskunftsrecht:</strong> Als registrierte*r Nutzer*in können Sie
            jederzeit in Ihren{" "}
            <Link href="/dashboard/settings/my-data" className="underline text-primary hover:text-primary/80">
              Kontoeinstellungen unter &quot;Meine Daten&quot;
            </Link>{" "}
            eine vollständige Übersicht aller gespeicherten Daten einsehen.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Recht auf Datenportabilität (Art. 20 DSGVO)</h3>
          <p>
            Sie haben das Recht, Ihre Daten in einem strukturierten, gängigen und maschinenlesbaren
            Format zu erhalten. Dies ermöglicht Ihnen, Ihre Daten zu einem anderen Anbieter zu
            übertragen.
          </p>
          <p className="mt-2">
            <strong>So exportieren Sie Ihre Daten:</strong> Nutzen Sie die Export-Funktion auf der{" "}
            <Link href="/dashboard/settings/my-data" className="underline text-primary hover:text-primary/80">
              &quot;Meine Daten&quot;
            </Link>{" "}
            Seite, um alle Ihre Daten als JSON-Datei herunterzuladen.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Recht auf Löschung (Art. 17 DSGVO)</h3>
          <p>
            Sie haben das Recht, die Löschung Ihrer personenbezogenen Daten zu verlangen
            (&quot;Recht auf Vergessenwerden&quot;). Nach der Löschung werden alle Ihre Daten innerhalb
            von 30 Tagen vollständig entfernt.
          </p>
          <p className="mt-2">
            <strong>So löschen Sie Ihr Konto:</strong> In den{" "}
            <Link href="/dashboard/settings" className="underline text-primary hover:text-primary/80">
              Einstellungen
            </Link>{" "}
            finden Sie die Option zur Kontolöschung.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Weitere Rechte</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Recht auf Berichtigung (Art. 16 DSGVO):</strong> Korrektur unrichtiger Daten</li>
            <li><strong>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO):</strong> Temporäre Einschränkung</li>
            <li><strong>Recht auf Widerspruch (Art. 21 DSGVO):</strong> Widerspruch gegen Datenverarbeitung</li>
            <li><strong>Beschwerderecht:</strong> Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde</li>
          </ul>

          <p className="mt-4 p-4 bg-muted rounded-lg">
            <strong>Kontakt für Datenschutzanfragen:</strong><br />
            Für die Ausübung weiterer Rechte oder bei Fragen zum Datenschutz kontaktieren Sie uns
            bitte unter: info@echoscribe.de
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
