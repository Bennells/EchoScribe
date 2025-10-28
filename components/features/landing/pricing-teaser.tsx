import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowRight } from "lucide-react";

const pricingTiers = [
  {
    name: "Free",
    price: "€0",
    description: "Perfekt zum Ausprobieren",
    features: [
      "3 Podcast-Analysen (Lifetime)",
      "Basis-Artikel-Generierung",
      "Standard-Support",
    ],
  },
  {
    name: "Starter",
    price: "€9,99",
    period: "/Monat",
    description: "Für regelmäßige Content-Creator",
    features: [
      "15 Podcast-Analysen pro Monat",
      "Erweiterte Artikel-Generierung",
      "E-Mail-Support",
    ],
    popular: true,
  },
  {
    name: "Professional",
    price: "€24,99",
    period: "/Monat",
    description: "Für professionelle Podcaster",
    features: [
      "60 Podcast-Analysen pro Monat",
      "Premium-Artikel-Qualität",
      "Prioritäts-Support",
    ],
  },
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="py-20 md:py-32 px-4 bg-muted/30 scroll-mt-16">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Transparente Preise für jede Größe
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Wählen Sie den Plan, der zu Ihren Bedürfnissen passt. Keine
            versteckten Gebühren, jederzeit kündbar.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {pricingTiers.map((tier, index) => (
            <Card
              key={index}
              className={`relative ${
                tier.popular
                  ? "border-primary shadow-xl scale-105 md:scale-110"
                  : ""
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg">
                    Beliebteste Wahl
                  </span>
                </div>
              )}

              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">{tier.name}</CardTitle>
                <CardDescription className="mb-4">
                  {tier.description}
                </CardDescription>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold">{tier.price}</span>
                  {tier.period && (
                    <span className="text-muted-foreground">{tier.period}</span>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA to Full Pricing */}
        <div className="text-center">
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="group">
              Alle Preise und Details ansehen
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
