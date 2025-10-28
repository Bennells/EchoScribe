import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

export function FinalCta() {
  return (
    <section className="py-20 md:py-32 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 p-12 md:p-16 text-white shadow-2xl">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />

          {/* Content */}
          <div className="relative z-10 text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Bereit, Ihre Podcasts in
              <br />
              hochwertige Artikel zu verwandeln?
            </h2>

            <p className="text-xl text-blue-50 max-w-2xl mx-auto leading-relaxed">
              Starten Sie noch heute kostenlos und erleben Sie, wie einfach
              Content-Erstellung sein kann. Keine Kreditkarte erforderlich.
            </p>

            {/* Benefits */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm text-blue-50">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                <span>3 kostenlose Podcasts</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                <span>Keine Kreditkarte nötig</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                <span>In 2 Minuten startklar</span>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-white text-violet-600 hover:bg-blue-50 text-lg px-10 py-7 h-auto font-semibold shadow-xl hover:shadow-2xl transition-all group"
                >
                  Jetzt kostenlos starten
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            {/* Subtext */}
            <p className="text-sm text-blue-100">
              Bereits über 1000+ Podcasts erfolgreich umgewandelt
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
