import {
  Search,
  Mic,
  Code,
  Tag,
  Settings,
  Shield,
  Share2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Search,
    title: "SEO Optimization",
    description:
      "Meta tags, keywords and OpenGraph for top rankings. Get found by more listeners on Google.",
  },
  {
    icon: Mic,
    title: "Automatic Transcription",
    description:
      "AI-powered transcription in highest quality. Multilingual and accurate for perfect texts.",
  },
  {
    icon: Share2,
    title: "Social Media Content",
    description:
      "Ready-made posts for LinkedIn, Twitter, Instagram and Facebook. Maximum reach across all channels.",
  },
  {
    icon: Tag,
    title: "Keyword Extraction",
    description:
      "Intelligent keyword analysis for better rankings. Relevant topics automatically identified.",
  },
  {
    icon: Settings,
    title: "Schema.org Markup",
    description:
      "Rich snippets for better visibility. Structured data for Google search results.",
  },
  {
    icon: Code,
    title: "Multiple Formats",
    description:
      "Export as Markdown, HTML or directly to CMS. Flexible for every workflow.",
  },
  {
    icon: Shield,
    title: "GDPR Compliant",
    description:
      "100% GDPR compliant with EU hosting. Your data stays safe and protected.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="py-20 md:py-32 px-4 scroll-mt-16 bg-muted/30">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Everything for Your{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Podcast Reach
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From transcription to distribution – all tools for
            maximum visibility of your podcasts
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="group hover:shadow-xl hover:border-primary/50 transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader>
                  <div className="mb-4 w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600/10 to-violet-600/10 flex items-center justify-center group-hover:from-blue-600/20 group-hover:to-violet-600/20 transition-colors">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
