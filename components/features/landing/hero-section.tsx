import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, X, Mic, Sparkles, FileText, Share2, Tag } from "lucide-react";
import { LAUNCH_SPECIAL_MODE } from "@/lib/constants/pricing";

export function HeroSection() {
  return (
    <section className="relative py-20 md:py-32 px-4 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-violet-50/30 to-background -z-10" />

      {/* Decorative Gradient Blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl -z-10" />

      <div className="container mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left space-y-8">
            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                More Reach
              </span>
              <br />
              <span className="text-foreground">for Your Podcasts</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Automatically convert your podcast episodes into SEO articles and social media posts.
              Reach more listeners across all channels.
            </p>

            {LAUNCH_SPECIAL_MODE && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-full text-sm font-semibold shadow-lg">
                <Sparkles className="h-4 w-4" />
                Launch Special: 200 Minutes Free!
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center pt-4">
              <Link href="/register">
                <Button size="lg" className="text-base px-8 py-6 group">
                  {LAUNCH_SPECIAL_MODE ? "Get 200 Minutes Free Now" : "Start Free"}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              {!LAUNCH_SPECIAL_MODE && (
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="text-base px-8 py-6">
                    View Pricing
                  </Button>
                </Link>
              )}
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-6 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <span>EU Hosting</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-blue-600" />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="h-5 w-5 text-blue-600" />
                <span>Cancel Anytime</span>
              </div>
            </div>

            {/* Data Processing Notice */}
            <div className="pt-4 max-w-xl mx-auto lg:mx-0">
              <p className="text-xs text-muted-foreground">
                AI processing by OpenAI (USA). All data is stored in the EU.{" "}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy details
                </Link>
              </p>
            </div>
          </div>

          {/* Right Column - Abstract Workflow Illustration */}
          <div className="relative flex justify-center items-center">
            <div className="relative w-full max-w-md">
              {/* Workflow Steps */}
              <div className="flex flex-col gap-8">
                {/* Step 1: Podcast Input */}
                <div className="relative bg-white rounded-2xl shadow-xl p-6 border-2 border-blue-100 hover:border-blue-300 transition-all hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <Mic className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Your Podcast</h3>
                      <p className="text-sm text-muted-foreground">MP3, WAV, M4A...</p>
                    </div>
                  </div>
                </div>

                {/* Arrow with AI Badge */}
                <div className="flex justify-center -my-4 relative z-10">
                  <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    <span className="font-semibold text-sm">AI Processing</span>
                  </div>
                </div>

                {/* Step 2: Multiple Outputs */}
                <div className="relative bg-white rounded-2xl shadow-xl p-6 border-2 border-violet-100 hover:border-violet-300 transition-all">
                  {/* Main Header */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-violet-100">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">You Get:</h3>
                      <p className="text-xs text-muted-foreground">Everything ready to publish</p>
                    </div>
                  </div>

                  {/* Output Items */}
                  <div className="space-y-3">
                    {/* SEO Article */}
                    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-violet-50/50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-4 w-4 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">SEO Article</p>
                        <p className="text-xs text-muted-foreground">Meta Tags • Keywords • Schema.org</p>
                      </div>
                    </div>

                    {/* Social Media */}
                    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-violet-50/50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Share2 className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Social Media Posts</p>
                        <p className="text-xs text-muted-foreground">LinkedIn • Twitter • Instagram • FB</p>
                      </div>
                    </div>

                  </div>

                  {/* Quick Stats */}
                  <div className="mt-4 pt-4 border-t border-violet-100 flex items-center justify-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-violet-600" />
                    <span className="text-xs font-medium text-violet-600">All in 2-5 minutes</span>
                  </div>
                </div>
              </div>

              {/* Background decoration */}
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl -z-10" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-violet-200/30 rounded-full blur-2xl -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
