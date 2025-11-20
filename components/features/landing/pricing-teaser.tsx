import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { LAUNCH_SPECIAL_MODE } from "@/lib/constants/pricing";

const pricingTiers = [
  {
    name: "Free",
    price: "€0",
    description: "100 minutes per month",
    features: [
      "100 minutes per month",
      "Social Media Posts",
      "SEO Package",
      "Batch Upload",
    ],
  },
  {
    name: "Starter",
    price: "€19",
    period: "/month",
    description: "240 minutes per month",
    features: [
      "240 minutes per month",
      "Social Media Posts",
      "SEO Package",
      "Batch Upload",
    ],
  },
  {
    name: "Professional",
    price: "€49",
    period: "/month",
    description: "600 minutes per month",
    features: [
      "600 minutes per month",
      "Social Media Posts",
      "SEO Package",
      "Batch Upload",
    ],
    popular: true,
  },
  {
    name: "Business",
    price: "€149",
    period: "/month",
    description: "2000 minutes per month",
    features: [
      "2000 minutes per month",
      "Social Media Posts",
      "SEO Package",
      "Batch Upload",
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
            {LAUNCH_SPECIAL_MODE ? (
              <>
                Launch{" "}
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  Special
                </span>
              </>
            ) : (
              <>
                Simple{" "}
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  Pricing
                </span>
              </>
            )}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {LAUNCH_SPECIAL_MODE
              ? "We're currently in launch phase. Pricing models will be available soon."
              : "Fair prices with no hidden costs. Cancel anytime."
            }
          </p>
        </div>

        {LAUNCH_SPECIAL_MODE ? (
          /* Launch Phase Placeholder */
          <div className="max-w-3xl mx-auto">
            <Card className="border-primary shadow-xl ring-2 ring-primary/20">
              <CardHeader className="text-center pb-8">
                <div className="flex justify-center mb-4">
                  <Sparkles className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-3xl mb-4">
                  Start Free
                </CardTitle>
                <CardDescription className="text-lg">
                  Start now with 200 free minutes and test all features.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3.5 max-w-md mx-auto">
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">200 minutes starting credit</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">Social Media Posts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">Complete SEO Package</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">Batch Upload</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">No credit card required</span>
                  </li>
                </ul>

                <div className="text-center pt-4">
                  <Link href="/dashboard">
                    <Button size="lg" className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
                      Start free now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12 px-4">
              {pricingTiers.map((tier, index) => (
                <Card
                  key={index}
                  className={`relative transition-all duration-300 hover:shadow-2xl ${
                    tier.popular
                      ? "border-primary shadow-xl ring-2 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl mb-2">{tier.name}</CardTitle>
                    <CardDescription className="mb-6 min-h-[3rem] flex items-center justify-center">
                      {tier.description}
                    </CardDescription>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold">{tier.price}</span>
                      {tier.period && (
                        <span className="text-muted-foreground ml-1">{tier.period}</span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <ul className="space-y-3.5">
                      {tier.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm leading-relaxed">{feature}</span>
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
                  View all prices and details
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
