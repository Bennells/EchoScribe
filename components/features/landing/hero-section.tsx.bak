import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, X } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative py-20 md:py-32 px-4 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-violet-50/30 to-background -z-10" />

      <div className="container mx-auto max-w-6xl">
        <div className="text-center space-y-8">
          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Podcasts in SEO-Artikel
            </span>
            <br />
            <span className="text-foreground">in Minuten verwandeln</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Automatische Transkription und KI-gestützte Umwandlung Ihrer
            Podcasts in hochwertige, SEO-optimierte Blog-Artikel. Sparen Sie
            Stunden an manueller Arbeit.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link href="/register">
              <Button size="lg" className="text-base px-8 py-6 group">
                Kostenlos starten
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-base px-8 py-6">
                Preise ansehen
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-6 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <span>100% DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              <span>Sichere Datenverarbeitung</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-blue-600" />
              <span>Jederzeit kündbar</span>
            </div>
          </div>

          {/* Optional: Social Proof Counter */}
          <p className="text-sm text-muted-foreground pt-4">
            Vertraut von Content-Creators und Podcastern
          </p>
        </div>
      </div>
    </section>
  );
}
