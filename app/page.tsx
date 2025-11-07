import { CookieBanner } from "@/components/features/cookie-banner";
import {
  Navigation,
  HeroSection,
  HowItWorks,
  FeaturesGrid,
  PricingTeaser,
  SeoBenefitsSection,
  FaqSection,
  FinalCta,
} from "@/components/features/landing";
import { LAUNCH_SPECIAL_MODE } from "@/lib/constants/pricing";
import { Sparkles } from "lucide-react";

export default function Home() {
  return (
    <>
      {/* Sticky Navigation */}
      <Navigation />

      {/* Launch Special Banner */}
      {LAUNCH_SPECIAL_MODE && (
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 text-white py-3 px-4 text-center">
          <div className="container mx-auto flex items-center justify-center gap-2 text-sm md:text-base font-semibold">
            <Sparkles className="h-4 w-4 md:h-5 md:w-5" />
            <span>Launch Special: Jetzt kostenlos mit 200 Minuten starten!</span>
            <Sparkles className="h-4 w-4 md:h-5 md:w-5" />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <HeroSection />

        {/* How It Works Section */}
        <HowItWorks />

        {/* Features Grid Section */}
        <FeaturesGrid />

        {/* Pricing Teaser Section */}
        <PricingTeaser />

        {/* SEO Benefits Section */}
        <SeoBenefitsSection />

        {/* FAQ Section */}
        <FaqSection />

        {/* Final CTA Section */}
        <FinalCta />
      </main>

      {/* Cookie Banner */}
      <CookieBanner />
    </>
  );
}
