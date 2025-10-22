import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
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
    </main>
  );
}
