import { Upload, Sparkles, FileText, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Podcast hochladen",
    description:
      "Drag & Drop Ihrer Audio-Datei. Alle gängigen Formate bis 500MB.",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "KI-Verarbeitung",
    description:
      "Automatische Transkription und Erstellung von SEO-Artikeln und Social Posts.",
  },
  {
    number: "03",
    icon: FileText,
    title: "Fertig zum Teilen",
    description:
      "Blog-Artikel und Social Media Content – alles bereit für Ihre Kanäle.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-32 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            So einfach geht&apos;s
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Von der Audio-Datei zu vollständigem Content in nur 3 Schritten
          </p>
        </div>

        {/* Steps Grid with Arrows */}
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative flex flex-col items-center">
                  <Card className="relative border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-2 w-full">
                    {/* Step Number Badge */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {step.number}
                    </div>

                    <CardContent className="pt-12 pb-8 px-6">
                      {/* Icon */}
                      <div className="mb-6 flex justify-center">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-10 w-10 text-primary" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="text-center space-y-3">
                        <h3 className="text-xl font-semibold">{step.title}</h3>
                        <p className="text-muted-foreground leading-relaxed text-sm">
                          {step.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Arrow between steps (desktop only) */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-8 -translate-y-1/2 z-10">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-violet-600">
                        <ArrowRight className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time Indicator */}
        <div className="mt-12 text-center">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-6 py-3 rounded-full">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold">Durchschnittliche Verarbeitungszeit: 2-5 Minuten</span>
          </p>
        </div>
      </div>
    </section>
  );
}
