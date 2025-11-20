import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Imprint - EchoScribes",
  description: "Imprint and contact information for EchoScribes.",
  path: "/imprint",
  noIndex: true,
});

export default function ImprintPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Imprint</h1>

      {/* Launch Phase Notice */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Project in Launch Phase</p>
          <p>
            This platform is currently in the Launch Special Phase.
            Complete company information will be added after business registration is complete.
          </p>
        </div>
      </div>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Responsible According to § 5 TMG</h2>
          <div className="mt-4 space-y-1 p-4 bg-muted/30 rounded-lg">
            <p className="font-medium">Dwayne Ellsworth</p>
            <p>Romeostraße 19</p>
            <p>76359 Marxzell</p>
            <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
              Business registration in progress • Future company name: Bennells
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Contact</h2>
          <div className="space-y-1">
            <p>Email: <a href="mailto:info@bennells.com" className="text-primary underline hover:no-underline">info@bennells.com</a></p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Notes During Launch Special</h2>
          <div className="p-4 bg-muted/30 rounded-lg space-y-2">
            <p className="text-sm">
              During the Launch Special Phase, EchoScribes is available free of charge with 200 minutes per month.
            </p>
            <p className="text-sm">
              No payments are processed and no paid subscriptions are offered.
            </p>
            <p className="text-sm">
              The complete VAT ID and additional legal information will be added after
              business registration is complete.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">
            Consumer Dispute Resolution / Universal Arbitration Board
          </h2>
          <p>
            We are neither willing nor obligated to participate in dispute resolution procedures
            before a consumer arbitration board.
          </p>
        </section>

        <section className="mt-12 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="underline hover:text-primary">
              Back to Homepage
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
