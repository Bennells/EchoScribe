import Link from "next/link";
import { CookieBanner } from "@/components/features/cookie-banner";

export default function Home() {
  return (
    <>
      <main className="flex min-h-screen flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl text-center space-y-8">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              EchoScribe
            </h1>
            <p className="text-xl text-muted-foreground">
              Wandeln Sie Podcasts automatisch in SEO-optimierte Blog-Artikel um
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                Jetzt starten
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Anmelden
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t py-6 px-8">
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
      </main>

      <CookieBanner />
    </>
  );
}
