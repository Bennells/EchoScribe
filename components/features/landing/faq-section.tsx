"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const faqs = [
  {
    question: "How long does it take to process a podcast?",
    answer:
      "Processing typically takes 2-5 minutes, depending on the length of your podcast episode. You'll be informed of progress in real-time and receive a notification once your article is ready.",
  },
  {
    question: "Which audio formats are supported?",
    answer:
      "We support all common audio formats like MP3, WAV, M4A, FLAC and OGG. The maximum file size is 250MB per upload.",
  },
  {
    question: "What happens if I run out of my monthly quota?",
    answer:
      "For paid plans, your quota automatically resets every month. If you use up your quota beforehand, you can either upgrade to a higher plan or wait until the next reset. Your already created articles remain available.",
  },
  {
    question: "Are my data safe and where are they processed?",
    answer:
      "Absolutely! We are GDPR compliant. All your data (account, audio files, articles) are hosted exclusively in the EU (Firebase + Google Cloud europe-west1). For AI processing, we use OpenAI (USA) with Zero Data Retention - OpenAI does NOT store your data permanently and does NOT use it for training. Audio files are automatically deleted after 30 days. You can export or delete your data at any time. Details in our privacy policy.",
  },
  {
    question: "Why do you use OpenAI and not an EU-based AI?",
    answer:
      "OpenAI currently offers the best quality for audio transcription and content generation. We use the API with Zero Data Retention, meaning your data is only used for processing and not stored or used for training afterwards. We're monitoring EU-based alternatives and will switch once they offer comparable quality.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 md:py-32 px-4 scroll-mt-16">
      <div className="container mx-auto max-w-4xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to know about EchoScribe
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border rounded-lg overflow-hidden bg-card hover:border-primary/50 transition-colors"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
              >
                <span className="font-semibold text-lg pr-8">
                  {faq.question}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200",
                    openIndex === index ? "rotate-180" : ""
                  )}
                />
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  openIndex === index ? "max-h-96" : "max-h-0"
                )}
              >
                <div className="px-6 pb-5 pt-2 text-muted-foreground leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Help & Feedback */}
        <div className="mt-12 text-center space-y-6">
          <div>
            <p className="text-muted-foreground mb-4">
              Have more questions? We&apos;re happy to help.
            </p>
            <a
              href="mailto:info@echoscribes.com"
              className="text-primary hover:underline font-medium"
            >
              Contact our support
            </a>
          </div>

          <div className="pt-6 border-t max-w-2xl mx-auto">
            <p className="text-muted-foreground mb-4">
              We appreciate your feedback! As a podcaster, you know best
              what you need. Share your ideas and wishes with us –
              we&apos;re here to help you.
            </p>
            <a
              href="mailto:info@echoscribes.com"
              className="text-primary hover:underline font-medium"
            >
              Send feedback to info@echoscribes.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
