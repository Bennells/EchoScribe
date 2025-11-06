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
    description: "100 Minuten pro Monat",
    features: [
      "100 Minuten pro Monat",
      "~3-4 Episoden (30 Min)",
      "Alle SEO-Features",
      "Monatliche Zurücksetzung",
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
      "~6-8 Episoden (30-40 Min)",
      "Komplettes SEO-Paket",
      "Export (Markdown & HTML)",
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
      "~15-20 Episoden",
      "Alles aus Starter",
      "Bulk Upload",
      "Eigener Schreibstil",
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
      "~50-65 Episoden",
      "Alles aus Professional",
      "API Zugang (bald)",
      "Prioritäts-Support",
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
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          💰 <span className="font-medium">20% sparen</span> mit Jahresabo
        </p>
      </div>
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
                  AM BELIEBTESTEN
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
    </div>
  );
}
