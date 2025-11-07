"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LAUNCH_SPECIAL_MODE } from "@/lib/constants/pricing";

export type PricingTier = "free" | "starter" | "professional" | "business";

interface PricingTierConfig {
  id: PricingTier;
  name: string;
  price: string;
  priceAmount?: number;
  description: string;
  features: string[];
  popular?: boolean;
  buttonText: string;
  buttonVariant?: "default" | "outline";
}

const allTiers: PricingTierConfig[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    description: LAUNCH_SPECIAL_MODE ? "200 Minuten pro Monat" : "100 Minuten pro Monat",
    features: [
      LAUNCH_SPECIAL_MODE ? "200 Minuten pro Monat" : "100 Minuten pro Monat",
      "Social Media Posts",
      "Show Notes",
      "SEO-Paket",
      "Massen-Upload",
    ],
    buttonText: "Kostenlos starten",
    buttonVariant: "outline",
  },
  {
    id: "starter",
    name: "Starter",
    price: "€19",
    priceAmount: 19,
    description: "240 Minuten pro Monat",
    features: [
      "240 Minuten pro Monat",
      "Social Media Posts",
      "Show Notes",
      "SEO-Paket",
      "Massen-Upload",
    ],
    buttonText: "Jetzt starten",
  },
  {
    id: "professional",
    name: "Professional",
    price: "€49",
    priceAmount: 49,
    description: "600 Minuten pro Monat",
    features: [
      "600 Minuten pro Monat",
      "Social Media Posts",
      "Show Notes",
      "SEO-Paket",
      "Massen-Upload",
    ],
    popular: true,
    buttonText: "Jetzt upgraden",
  },
  {
    id: "business",
    name: "Business",
    price: "€149",
    priceAmount: 149,
    description: "2000 Minuten pro Monat",
    features: [
      "2000 Minuten pro Monat",
      "Social Media Posts",
      "Show Notes",
      "SEO-Paket",
      "Massen-Upload",
    ],
    buttonText: "Jetzt upgraden",
  },
];

// During Launch Special, only show free tier
const tiers = LAUNCH_SPECIAL_MODE ? allTiers.filter(t => t.id === "free") : allTiers;

interface PricingCardsProps {
  currentTier?: PricingTier;
  onSelectTier?: (tier: PricingTier) => void;
  isAuthenticated?: boolean;
  loading?: boolean;
  loadingTier?: PricingTier | null;
}

export function PricingCards({
  currentTier,
  onSelectTier,
  isAuthenticated = false,
  loading = false,
  loadingTier = null,
}: PricingCardsProps) {
  const getButtonText = (tier: PricingTierConfig) => {
    if (!isAuthenticated) {
      return tier.id === "free" ? "Kostenlos starten" : "Jetzt starten";
    }

    if (currentTier === tier.id) {
      return "Aktueller Plan";
    }

    if (tier.id === "free") {
      return "Kostenlos";
    }

    // Determine if this is an upgrade or downgrade
    const tierOrder = ["free", "starter", "professional", "business"];
    const currentIndex = tierOrder.indexOf(currentTier || "free");
    const targetIndex = tierOrder.indexOf(tier.id);

    if (targetIndex > currentIndex) {
      return "Zu diesem Plan wechseln";
    } else {
      return "Zu diesem Plan wechseln";
    }
  };

  const isButtonDisabled = (tier: PricingTierConfig) => {
    if (loading && loadingTier === tier.id) return true;
    if (isAuthenticated && currentTier === tier.id) return true;
    return false;
  };

  const handleButtonClick = (tier: PricingTierConfig) => {
    if (!isAuthenticated) {
      // Redirect to register
      window.location.href = "/register";
    } else if (onSelectTier) {
      onSelectTier(tier.id);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className={cn(
        "grid gap-6 w-full max-w-7xl mx-auto px-4",
        LAUNCH_SPECIAL_MODE ? "grid-cols-1 md:max-w-md" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      )}>
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={cn(
              "relative flex flex-col transition-all duration-300 hover:shadow-xl",
              tier.popular && !LAUNCH_SPECIAL_MODE && "border-primary shadow-lg ring-2 ring-primary/20",
              currentTier === tier.id && "border-primary ring-2 ring-primary/20",
              LAUNCH_SPECIAL_MODE && "border-primary shadow-lg ring-2 ring-primary/20"
            )}
          >
            {LAUNCH_SPECIAL_MODE && tier.id === "free" && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  LAUNCH SPECIAL: 200 MINUTEN GRATIS
                </span>
              </div>
            )}
            {tier.popular && !LAUNCH_SPECIAL_MODE && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg">
                  AM BELIEBTESTEN
                </span>
              </div>
            )}

          <CardHeader className="pb-8">
            <CardTitle className="text-2xl">{tier.name}</CardTitle>
            <CardDescription className="mt-2">{tier.description}</CardDescription>
            <div className="mt-6">
              <span className="text-4xl font-bold">{tier.price}</span>
              {tier.priceAmount && (
                <span className="text-muted-foreground ml-1">/Monat</span>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col pt-0">
            <ul className="space-y-3.5 mb-8 flex-1">
              {tier.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => handleButtonClick(tier)}
              disabled={isButtonDisabled(tier)}
              variant={
                currentTier === tier.id
                  ? "outline"
                  : tier.popular
                  ? "default"
                  : "outline"
              }
              className="w-full"
            >
              {loading && loadingTier === tier.id
                ? "Wird geladen..."
                : getButtonText(tier)}
            </Button>
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}
