"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const faqs = [
  {
    question: "Wie lange dauert die Verarbeitung eines Podcasts?",
    answer:
      "Die Verarbeitung dauert in der Regel 2-5 Minuten, abhängig von der Länge Ihrer Podcast-Episode. Sie werden in Echtzeit über den Fortschritt informiert und erhalten eine Benachrichtigung, sobald Ihr Artikel fertig ist.",
  },
  {
    question: "Welche Audioformate werden unterstützt?",
    answer:
      "Wir unterstützen alle gängigen Audioformate wie MP3, WAV, M4A, FLAC und OGG. Die maximale Dateigröße beträgt 500MB pro Upload.",
  },
  {
    question: "Was passiert, wenn ich meine monatliche Quota aufbrauche?",
    answer:
      "Bei bezahlten Plänen wird Ihre Quota jeden Monat automatisch zurückgesetzt. Wenn Sie Ihre Quota vorher aufbrauchen, können Sie entweder auf einen höheren Plan upgraden oder bis zur nächsten Zurücksetzung warten. Ihre bereits erstellten Artikel bleiben verfügbar.",
  },
  {
    question: "Sind meine Daten sicher?",
    answer:
      "Absolut! Wir sind vollständig DSGVO-konform mit Hosting in der EU. Ihre Podcast-Dateien und generierten Artikel werden sicher verschlüsselt gespeichert. Sie können Ihre Daten jederzeit exportieren oder löschen.",
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
            Häufig gestellte Fragen
          </h2>
          <p className="text-xl text-muted-foreground">
            Alles, was Sie über EchoScribe wissen müssen
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

        {/* Additional Help */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Haben Sie weitere Fragen? Wir helfen Ihnen gerne weiter.
          </p>
          <a
            href="mailto:support@echoscribe.com"
            className="text-primary hover:underline font-medium"
          >
            Kontaktieren Sie unseren Support
          </a>
        </div>
      </div>
    </section>
  );
}
