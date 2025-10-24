import Link from "next/link";
import { PricingCards } from "@/components/features/pricing/pricing-cards";

export const metadata = {
  title: "Preise - EchoScribe",
  description: "Wählen Sie den perfekten Plan für Ihre Podcast-zu-Artikel-Konvertierung",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            EchoScribe
          </Link>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Anmelden
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Hero Section */}
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Einfache, transparente Preise
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Wählen Sie den Plan, der am besten zu Ihren Bedürfnissen passt.
              Keine versteckten Gebühren, jederzeit kündbar.
            </p>
          </div>

          {/* Pricing Cards */}
          <PricingCards />

          {/* FAQ Section */}
          <div className="mt-24 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Häufig gestellte Fragen
            </h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Wie funktioniert die monatliche Quota?
                </h3>
                <p className="text-muted-foreground">
                  Bei den bezahlten Plänen (Starter, Professional, Business) wird Ihre Quota jeden Monat automatisch zurückgesetzt.
                  Sie können dann wieder die volle Anzahl an Podcasts analysieren. Beim Free-Plan haben Sie insgesamt 3 Analysen ohne Zurücksetzung.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Kann ich meinen Plan jederzeit ändern?
                </h3>
                <p className="text-muted-foreground">
                  Ja, Sie können jederzeit upgraden oder downgraden. Beim Upgrade erhalten Sie sofort Zugriff auf die neuen Features.
                  Beim Downgrade erfolgt die Änderung zum Ende des aktuellen Abrechnungszeitraums.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Welche Zahlungsmethoden werden akzeptiert?
                </h3>
                <p className="text-muted-foreground">
                  Wir akzeptieren alle gängigen Kreditkarten (Visa, Mastercard, American Express) sowie SEPA-Lastschrift.
                  Die Zahlung wird sicher über Stripe abgewickelt.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Was passiert, wenn ich meine monatliche Quota aufbrauche?
                </h3>
                <p className="text-muted-foreground">
                  Sie können erst im nächsten Monat wieder neue Podcasts analysieren oder Sie upgraden auf einen höheren Plan mit mehr Quota.
                  Ihre bereits erstellten Artikel bleiben natürlich weiterhin verfügbar.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Gibt es eine Geld-zurück-Garantie?
                </h3>
                <p className="text-muted-foreground">
                  Ja, wir bieten eine 14-Tage-Geld-zurück-Garantie für alle bezahlten Pläne.
                  Wenn Sie nicht zufrieden sind, erstatten wir Ihnen den vollen Betrag zurück.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Kann ich den Free-Plan testen, bevor ich upgraden?
                </h3>
                <p className="text-muted-foreground">
                  Absolut! Der Free-Plan ist perfekt, um EchoScribe auszuprobieren.
                  Sie erhalten 3 kostenlose Podcast-Analysen und können sich dann entscheiden, ob Sie upgraden möchten.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-24 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Bereit loszulegen?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Starten Sie noch heute mit EchoScribe und verwandeln Sie Ihre Podcasts in hochwertige Blog-Artikel.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Jetzt kostenlos starten
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-8 mt-16">
        <div className="container mx-auto flex flex-col gap-4 md:flex-row md:justify-between md:items-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} EchoScribe. Alle Rechte vorbehalten.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Datenschutz
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              AGB
            </Link>
            <Link href="/imprint" className="hover:text-primary transition-colors">
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
