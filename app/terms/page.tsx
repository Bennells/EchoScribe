import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Terms of Service - EchoScribes",
  description: "Terms of Service for using EchoScribes.",
  path: "/terms",
  noIndex: true,
});

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

      {/* Launch Phase Notice */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Launch Special Phase</p>
          <p>
            During the Launch Special Phase, only the free plan with 200 minutes is available.
            These Terms of Service will be updated after the official launch phase with paid plans.
          </p>
        </div>
      </div>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Scope</h2>
          <p>
            These Terms of Service apply to the use of EchoScribes, a service for converting
            podcasts into blog articles.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Service Description</h2>
          <p>
            EchoScribes offers a service for automatically converting audio podcasts into
            SEO-optimized blog articles using artificial intelligence (OpenAI ChatGPT).
          </p>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg my-4">
            <p className="font-semibold text-yellow-900">Notice About Data Processing:</p>
            <p className="text-yellow-800 mt-2">
              AI processing is performed by OpenAI on servers in the USA. All other data
              (account, files, articles) is stored exclusively in the EU. Details can be found
              in our{" "}
              <Link href="/privacy" className="underline font-semibold">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <h3 className="text-xl font-semibold mt-6 mb-3">2.1 Scope of Services</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Upload of audio files (max. 500 MB) with storage in the EU</li>
            <li>Automatic transcription and article generation by OpenAI (USA)</li>
            <li>Provision in Markdown and HTML format</li>
            <li>SEO optimization (meta descriptions, keywords, Schema.org)</li>
            <li>Automatic deletion of audio files after 30 days</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Terms of Use</h2>
          <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Registration</h3>
          <p>
            Using the service requires registration with a valid email address and password.
          </p>
          <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Permitted Use</h3>
          <p>The service may only be used for legal purposes. The following is prohibited:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Uploading copyrighted material without authorization</li>
            <li>Uploading illegal, offensive, or harmful content</li>
            <li>Abuse of the service (e.g., automated requests, DDoS)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Pricing and Payment</h2>
          <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Free Tier</h3>
          <p>
            <strong>During the Launch Special Phase:</strong> The free plan includes 200 minutes
            of audio processing per month. This quota renews monthly. No payments are processed
            and no paid subscriptions are offered.
          </p>
          <p className="mt-3">
            <strong>After the Launch Special Phase:</strong> The free plan includes 100 minutes
            of audio processing per month with monthly renewal.
          </p>
          <h3 className="text-xl font-semibold mt-6 mb-3">4.2 Paid Subscriptions (After Launch Phase)</h3>
          <p>
            After the Launch Special Phase concludes, paid subscriptions with extended quotas
            will be available. These will be processed through Stripe. Billing will then occur
            monthly in advance. Existing users will be informed in advance about availability
            and terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Liability</h2>
          <p>
            The generated articles are created automatically by AI. We do not guarantee the
            accuracy, completeness, or quality of the results. Users are responsible for
            reviewing and using the articles.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Privacy</h2>
          <p>
            For the processing of personal data, our{" "}
            <Link href="/privacy" className="text-primary underline hover:no-underline">
              Privacy Policy
            </Link>{" "}
            applies.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Termination</h2>
          <p>
            Users can delete their account at any time in the settings. For paid subscriptions,
            the service ends at the end of the billing period.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">8. Changes to Terms of Service</h2>
          <p>
            We reserve the right to change these Terms of Service at any time. Users will be
            informed of changes via email.
          </p>
        </section>

        <section className="mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString("en-US")}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <Link href="/" className="underline hover:text-primary">
              Back to Homepage
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
