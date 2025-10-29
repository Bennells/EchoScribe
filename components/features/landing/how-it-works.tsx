import { Upload, Sparkles, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Podcast hochladen",
    description:
      "Laden Sie Ihre Podcast-Audiodatei einfach per Drag & Drop hoch. Unterstützt alle gängigen Formate bis 500MB.",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "KI-Verarbeitung",
    description:
      "Unsere KI transkribiert und analysiert Ihren Podcast automatisch und erstellt einen strukturierten Artikel mit optimierten Inhalten.",
  },
  {
    number: "03",
    icon: FileText,
    title: "Fertiger SEO-Artikel",
    description:
      "Erhalten Sie einen vollständig formatierten Blog-Artikel mit Meta-Tags, Keywords, Schema.org Markup und mehr.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-32 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            So einfach funktioniert&apos;s
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Von der Audio-Datei zum fertigen Blog-Artikel in nur 3 Schritten
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card
                key={index}
                className="relative border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
              >
                {/* Step Number Badge */}
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {step.number}
                </div>

                <CardContent className="pt-8 pb-6 px-6">
                  {/* Icon */}
                  <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="text-center space-y-3">
                    <h3 className="text-xl font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Optional: Visual Connector */}
        <div className="hidden md:block relative mt-8">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600 opacity-20 -translate-y-1/2 -z-10" />
        </div>
      </div>
    </section>
  );
}
