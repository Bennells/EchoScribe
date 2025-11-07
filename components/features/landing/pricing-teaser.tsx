import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowRight } from "lucide-react";

const pricingTiers = [
  {
    name: "Free",
    price: "€0",
    description: "100 Minuten pro Monat",
    features: [
      "100 Minuten Audio pro Monat",
      "Alle SEO-Features",
      "Social Media Content",
    ],
  },
  {
    name: "Starter",
    price: "€19",
    period: "/Monat",
    description: "240 Minuten pro Monat",
    features: [
      "240 Minuten Audio pro Monat",
      "Alle SEO-Features",
      "Social Media Content",
      "Podcast Show Notes",
    ],
    popular: true,
  },
  {
    name: "Professional",
    price: "€49",
    period: "/Monat",
    description: "600 Minuten pro Monat",
    features: [
      "600 Minuten Audio pro Monat",
      "Alle SEO-Features",
      "Social Media Content",
      "Podcast Show Notes",
    ],
  },
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="py-20 md:py-32 px-4 scroll-mt-16">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Einfache{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Preise
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Faire Preise ohne versteckte Kosten. Jederzeit kündbar.
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
