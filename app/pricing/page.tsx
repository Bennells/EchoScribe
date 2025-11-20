import Link from "next/link";
import { PricingCards } from "@/components/features/pricing/pricing-cards";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Pricing - EchoScribe | Transparent Pricing Plans",
  description: "Choose the perfect plan for your podcast-to-article conversion. Start from €0. No hidden fees, cancel anytime. 14-day money-back guarantee.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            EchoScribe
          </Link>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Hero Section */}
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that best fits your needs.
              No hidden fees, cancel anytime.
            </p>
          </div>

          {/* Pricing Cards */}
          <PricingCards />

          {/* FAQ Section */}
          <div className="mt-24 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  How does the monthly quota work?
                </h3>
                <p className="text-muted-foreground">
                  With paid plans (Starter, Professional, Business), your quota resets automatically every month.
                  You can then analyze the full number of podcasts again. The Free plan has 3 total analyses without reset.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Can I change my plan at any time?
                </h3>
                <p className="text-muted-foreground">
                  Yes, you can upgrade or downgrade at any time. When upgrading, you get immediate access to new features.
                  When downgrading, the change takes effect at the end of your current billing period.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  What payment methods are accepted?
                </h3>
                <p className="text-muted-foreground">
                  We accept all major credit cards (Visa, Mastercard, American Express) as well as SEPA direct debit.
                  Payments are securely processed through Stripe.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  What happens if I use up my monthly quota?
                </h3>
                <p className="text-muted-foreground">
                  You can analyze new podcasts again next month, or upgrade to a higher plan with more quota.
                  Your previously created articles remain available, of course.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Is there a money-back guarantee?
                </h3>
                <p className="text-muted-foreground">
                  Yes, we offer a 14-day money-back guarantee for all paid plans.
                  If you&apos;re not satisfied, we&apos;ll refund you the full amount.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Can I try the Free plan before upgrading?
                </h3>
                <p className="text-muted-foreground">
                  Absolutely! The Free plan is perfect for trying out EchoScribe.
                  You get 3 free podcast analyses and can then decide if you want to upgrade.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-24 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start with EchoScribe today and transform your podcasts into high-quality blog articles.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-8 mt-16">
        <div className="container mx-auto flex flex-col gap-4 md:flex-row md:justify-between md:items-center text-sm text-muted-foreground">
          <p>Copyright &copy; {new Date().getFullYear()} Bennells</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
            <Link href="/imprint" className="hover:text-primary transition-colors">
              Imprint
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
