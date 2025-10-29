"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

const tiers: PricingTierConfig[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    description: "3 Podcasts insgesamt (Lifetime)",
    features: [
      "3 Podcast-Analysen (Lifetime)",
    ],
    buttonText: "Aktueller Plan",
    buttonVariant: "outline",
  },
  {
    id: "starter",
    name: "Starter",
    price: "€9,99",
    priceAmount: 9.99,
    description: "15 Podcasts pro Monat",
    features: [
      "15 Podcast-Analysen pro Monat",
      "Monatliche Quota-Zurücksetzung",
    ],
    buttonText: "Jetzt starten",
  },
  {
    id: "professional",
    name: "Professional",
    price: "€24,99",
    priceAmount: 24.99,
    description: "60 Podcasts pro Monat",
    features: [
      "60 Podcast-Analysen pro Monat",
      "Monatliche Quota-Zurücksetzung",
    ],
    popular: true,
    buttonText: "Jetzt upgraden",
  },
  {
    id: "business",
    name: "Business",
    price: "€49,99",
    priceAmount: 49.99,
    description: "150 Podcasts pro Monat",
    features: [
      "150 Podcast-Analysen pro Monat",
      "Monatliche Quota-Zurücksetzung",
    ],
    buttonText: "Jetzt upgraden",
  },
];

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

    return "Jetzt upgraden";
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      {tiers.map((tier) => (
        <Card
          key={tier.id}
          className={cn(
            "relative flex flex-col",
            tier.popular && "border-primary shadow-lg scale-105",
            currentTier === tier.id && "border-primary"
          )}
        >
          {tier.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                Beliebteste Wahl
              </span>
            </div>
          )}

          <CardHeader>
            <CardTitle className="text-2xl">{tier.name}</CardTitle>
            <CardDescription>{tier.description}</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">{tier.price}</span>
              {tier.priceAmount && (
                <span className="text-muted-foreground">/Monat</span>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col">
            <ul className="space-y-3 mb-6 flex-1">
              {tier.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
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
  );
}
