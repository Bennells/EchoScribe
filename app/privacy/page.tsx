import Link from "next/link";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Privacy Policy - EchoScribes",
  description: "Privacy Policy for EchoScribes. EU hosting with AI processing by OpenAI (USA).",
  path: "/privacy",
  noIndex: true,
});

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose prose-slate max-w-none space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Privacy at a Glance</h2>
          <h3 className="text-xl font-semibold mt-6 mb-3">General Information</h3>
          <p>
            The following information provides a simple overview of what happens to your
            personal data when you visit this website. Personal data is any data that can
            be used to personally identify you.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Data Collection</h2>
          <h3 className="text-xl font-semibold mt-6 mb-3">What data do we collect?</h3>
          <p>We collect the following data:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email address (during registration)</li>
            <li>Uploaded audio files (podcasts)</li>
            <li>Generated blog articles</li>
            <li>Usage statistics (number of uploads, quota consumption)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Hosting and Infrastructure (EU)</h2>
          <p>
            This website uses Firebase by Google for authentication, database, and file storage.{" "}
            <strong>All your data (account data, audio files, generated articles) is stored
            exclusively on Google servers in the EU.</strong>
          </p>
          <p className="mt-2">
            Services used with EU hosting:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Firebase Authentication (user authentication)</li>
            <li>Cloud Firestore (database)</li>
            <li>Cloud Storage (file storage)</li>
            <li>Firebase App Hosting (web server)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. AI Processing by OpenAI (USA)</h2>
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
            <p className="font-semibold text-yellow-900">Important Notice About Data Processing:</p>
            <p className="text-yellow-800 mt-2">
              For AI-powered processing of your audio files, we use the OpenAI API (ChatGPT).
              This processing takes place on OpenAI servers in the USA.
            </p>
          </div>

          <h3 className="text-xl font-semibold mt-6 mb-3">Processing Workflow:</h3>
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>EU:</strong> You upload your audio file to our servers in the EU</li>
            <li><strong>USA:</strong> The audio file is transferred to OpenAI servers in the USA for processing</li>
            <li><strong>USA:</strong> OpenAI creates the transcript and blog article</li>
            <li><strong>EU:</strong> The results are transferred back to our EU servers and stored there</li>
            <li><strong>Automatic Deletion:</strong> The original audio file is automatically deleted from our EU storage after 30 days</li>
          </ol>

          <h3 className="text-xl font-semibold mt-6 mb-3">Privacy at OpenAI:</h3>
          <p>
            We use the <strong>OpenAI API with Zero Data Retention</strong>. This means:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>OpenAI does <strong>not permanently store</strong> your data</li>
            <li>Your data is <strong>not used for training</strong> AI models</li>
            <li>The data is only used to process your request and then deleted</li>
            <li>OpenAI has strict privacy policies according to their Privacy Policy</li>
          </ul>

          <p className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <strong>Legal Basis:</strong> Data transfer to the USA is based on your consent
            (Art. 6 para. 1 lit. a GDPR) by using the service. You can object to this
            processing at any time by discontinuing use of the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Your Rights Under GDPR</h2>
          <p>
            According to the General Data Protection Regulation (GDPR), you have comprehensive
            rights regarding your personal data:
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Right to Access (Art. 15 GDPR)</h3>
          <p>
            You have the right to obtain information about all your personal data stored
            with us at any time. This includes:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>What data we store about you</li>
            <li>The purpose for which this data is processed</li>
            <li>To whom your data is disclosed</li>
            <li>How long your data is stored</li>
          </ul>
          <p className="mt-4">
            <strong>How to exercise your right to access:</strong> As a registered user, you can
            view a complete overview of all stored data at any time in your{" "}
            <Link href="/dashboard/settings/my-data" className="underline text-primary hover:text-primary/80">
              account settings under &quot;My Data&quot;
            </Link>.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Right to Data Portability (Art. 20 GDPR)</h3>
          <p>
            You have the right to receive your data in a structured, commonly used, and
            machine-readable format. This allows you to transfer your data to another provider.
          </p>
          <p className="mt-2">
            <strong>How to export your data:</strong> Use the export function on the{" "}
            <Link href="/dashboard/settings/my-data" className="underline text-primary hover:text-primary/80">
              &quot;My Data&quot;
            </Link>{" "}
            page to download all your data as a JSON file.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Right to Erasure (Art. 17 GDPR)</h3>
          <p>
            You have the right to request the deletion of your personal data
            (&quot;right to be forgotten&quot;). After deletion, all your data will be
            completely removed within 30 days.
          </p>
          <p className="mt-2">
            <strong>How to delete your account:</strong> In the{" "}
            <Link href="/dashboard/settings" className="underline text-primary hover:text-primary/80">
              Settings
            </Link>{" "}
            you will find the option to delete your account.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Additional Rights</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Right to Rectification (Art. 16 GDPR):</strong> Correction of inaccurate data</li>
            <li><strong>Right to Restriction of Processing (Art. 18 GDPR):</strong> Temporary restriction</li>
            <li><strong>Right to Object (Art. 21 GDPR):</strong> Objection to data processing</li>
            <li><strong>Right to Lodge a Complaint:</strong> Complaint with the competent data protection supervisory authority</li>
          </ul>

          <p className="mt-4 p-4 bg-muted rounded-lg">
            <strong>Contact for Privacy Inquiries:</strong><br />
            To exercise additional rights or if you have questions about privacy, please
            contact us at: info@echoscribes.com
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">6. Data Deletion</h2>
          <p>
            You can delete your account at any time in the settings. All your data
            (email, podcasts, articles) will be permanently deleted.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">7. Cookies</h2>
          <p>
            This website uses only technically necessary cookies for authentication.
            These are required for the website to function.
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
