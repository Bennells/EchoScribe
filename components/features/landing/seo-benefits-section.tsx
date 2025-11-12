import { TrendingUp, Users, Globe, Zap } from "lucide-react";

const benefits = [
  {
    icon: TrendingUp,
    title: "Bessere Rankings",
    description:
      "Meta-Tags und Keywords helfen Google, Ihre Inhalte zu verstehen und höher zu ranken.",
  },
  {
    icon: Users,
    title: "Mehr Hörer*innen",
    description:
      "Menschen finden Ihre Podcasts über Google-Suche – erschließen Sie neue Zielgruppen.",
  },
  {
    icon: Globe,
    title: "Größere Reichweite",
    description:
      "Social Media Posts verbreiten Ihre Inhalte automatisch auf allen wichtigen Kanälen.",
  },
  {
    icon: Zap,
    title: "Zeit sparen",
    description:
      "Statt Stunden für Content-Erstellung – fertig in Minuten. Mehr Zeit fürs Podcasten.",
  },
];

export function SeoBenefitsSection() {
  return (
    <section className="py-20 md:py-32 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Warum{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              SEO-optimierte Artikel
            </span>{" "}
            für Podcaster*innen wichtig sind
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Die meisten Hörer*innen finden neue Podcasts über Google, nicht über Podcast-Apps.
            Mit SEO-optimierten Artikeln erschließen Sie diese riesige Zielgruppe.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="text-center space-y-4"
              >
                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-600/10 to-violet-600/10 flex items-center justify-center">
                  <Icon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{benefit.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats or Additional Info */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Die meisten Podcast-Hörer*innen
          </h3>
          <p className="text-xl md:text-2xl opacity-90 max-w-2xl mx-auto">
            suchen zuerst auf Google nach Podcasts zu ihren Interessen.
            Seien Sie dort sichtbar, wo Ihre Zielgruppe sucht.
          </p>
        </div>
      </div>
    </section>
  );
}
