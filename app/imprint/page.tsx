import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function ImprintPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Impressum</h1>

      {/* Launch Phase Notice */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Projekt in Launch-Phase</p>
          <p>
            Diese Plattform befindet sich aktuell in der Launch Special Phase.
            Die vollständigen Unternehmensinformationen werden nach Abschluss der Gewerbeanmeldung ergänzt.
          </p>
        </div>
      </div>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Verantwortlich gemäß § 5 TMG</h2>
          <div className="mt-4 space-y-1 p-4 bg-muted/30 rounded-lg">
            <p className="font-medium">Dwayne Ellsworth</p>
            <p>Romeostraße 19</p>
            <p>76359 Marxzell</p>
            <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
              Gewerbeanmeldung läuft • Zukünftiger Unternehmensname: Bennells
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Kontakt</h2>
          <div className="space-y-1">
            <p>E-Mail: <a href="mailto:info@bennells.com" className="text-primary underline hover:no-underline">info@bennells.com</a></p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Hinweise während Launch Special</h2>
          <div className="p-4 bg-muted/30 rounded-lg space-y-2">
            <p className="text-sm">
              Während der Launch Special Phase ist EchoScribe kostenlos mit 200 Minuten pro Monat nutzbar.
            </p>
            <p className="text-sm">
              Es werden keine Zahlungen verarbeitet und keine kostenpflichtigen Abonnements angeboten.
            </p>
            <p className="text-sm">
              Die vollständige Umsatzsteuer-ID und weitere rechtliche Angaben werden nach Abschluss
              der Gewerbeanmeldung ergänzt.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">
            Verbraucherstreitbeilegung / Universalschlichtungsstelle
          </h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section className="mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="underline hover:text-primary">
              Zurück zur Startseite
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
