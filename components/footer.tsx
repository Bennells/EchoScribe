import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t py-8 px-4 bg-muted/30">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Logo & Copyright */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <Link
              href="/"
              className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent"
            >
              EchoScribe
            </Link>
            <p className="text-sm text-muted-foreground">
              Copyright &copy; {new Date().getFullYear()} Bennells
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Datenschutz
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              AGB
            </Link>
            <Link
              href="/imprint"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Impressum
            </Link>
            <a
              href="mailto:support@echoscribe.com"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Kontakt
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
