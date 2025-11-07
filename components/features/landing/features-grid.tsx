import {
  Search,
  Mic,
  Code,
  Tag,
  Settings,
  Shield,
  Share2,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Search,
    title: "SEO-Optimierung",
    description:
      "Meta-Tags, Keywords und OpenGraph für Top-Rankings. Lassen Sie sich von mehr Hörern auf Google finden.",
  },
  {
    icon: Mic,
    title: "Automatische Transkription",
    description:
      "KI-gestützte Transkription in höchster Qualität. Mehrsprachig und akkurat für perfekte Texte.",
  },
  {
    icon: Share2,
    title: "Social Media Content",
    description:
      "Fertige Posts für LinkedIn, Twitter, Instagram und Facebook. Maximale Reichweite auf allen Kanälen.",
  },
  {
    icon: BookOpen,
    title: "Podcast Show Notes",
    description:
      "Automatisch generierte Kapitel, Zitate und Ressourcen. Professionelle Show Notes in Sekunden.",
  },
  {
    icon: Tag,
    title: "Keyword-Extraktion",
    description:
      "Intelligente Keyword-Analyse für bessere Rankings. Relevante Themen automatisch identifiziert.",
  },
  {
    icon: Settings,
    title: "Schema.org Markup",
    description:
      "Rich Snippets für bessere Sichtbarkeit. Strukturierte Daten für Google-Suchergebnisse.",
  },
  {
    icon: Code,
    title: "Mehrere Formate",
    description:
      "Export als Markdown, HTML oder direkt ins CMS. Flexibel für jeden Workflow.",
  },
  {
    icon: Shield,
    title: "DSGVO-konform",
    description:
      "100% DSGVO-konform mit EU-Hosting. Ihre Daten bleiben sicher und geschützt.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="py-20 md:py-32 px-4 scroll-mt-16 bg-muted/30">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Alles für Ihre{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Podcast-Reichweite
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Von der Transkription bis zur Verbreitung – alle Tools für
            maximale Sichtbarkeit Ihrer Podcasts
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="group hover:shadow-xl hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader>
                  <div className="mb-4 w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600/10 to-violet-600/10 flex items-center justify-center group-hover:from-blue-600/20 group-hover:to-violet-600/20 transition-colors">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
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
