import {
  Search,
  Mic,
  Code,
  Tag,
  Settings,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Search,
    title: "SEO-Optimierung",
    description:
      "Automatisch generierte Meta-Beschreibungen, Keywords und OpenGraph-Tags für maximale Sichtbarkeit in Suchmaschinen.",
  },
  {
    icon: Mic,
    title: "Automatische Transkription",
    description:
      "Hochpräzise KI-gestützte Transkription Ihrer Podcast-Episoden mit Unterstützung für mehrere Sprachen.",
  },
  {
    icon: Code,
    title: "Mehrere Formate",
    description:
      "Exportieren Sie Ihre Artikel in Markdown, HTML oder direkt für Ihr CMS. Volle Flexibilität für Ihren Workflow.",
  },
  {
    icon: Tag,
    title: "Keyword-Extraktion",
    description:
      "Intelligente Identifikation relevanter Keywords und Themen aus Ihrem Podcast-Inhalt für bessere Rankings.",
  },
  {
    icon: Settings,
    title: "Schema.org Markup",
    description:
      "Rich Snippets und strukturierte Daten für verbesserte Darstellung in Google-Suchergebnissen.",
  },
  {
    icon: Shield,
    title: "DSGVO-konform",
    description:
      "Vollständig DSGVO-konforme Verarbeitung mit Hosting in der EU. Ihre Daten bleiben sicher und geschützt.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="py-20 md:py-32 px-4 scroll-mt-16">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Alles, was Sie für erfolgreiche{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Content-Erstellung
            </span>{" "}
            brauchen
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Leistungsstarke Features, die Ihre Podcast-Inhalte in
            hochwertige Blog-Artikel verwandeln
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="group hover:shadow-xl hover:border-primary/50 transition-all duration-300"
              >
                <CardHeader>
                  <div className="mb-4 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600/10 to-violet-600/10 flex items-center justify-center group-hover:from-blue-600/20 group-hover:to-violet-600/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
