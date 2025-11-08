import { siteConfig } from "@/lib/metadata";

interface StructuredDataProps {
  children?: React.ReactNode;
}

/**
 * Organization Schema - Firmendaten für alle Seiten
 */
export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "EchoScribe",
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo.png`,
    description: siteConfig.description,
    address: {
      "@type": "PostalAddress",
      addressCountry: "DE",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      availableLanguage: "German",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * WebSite Schema - Website-Info für Homepage
 */
export function WebSiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "EchoScribe",
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: "de-DE",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/dashboard?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * FAQPage Schema - Strukturierte FAQ-Daten für Rich Snippets
 */
export function FAQPageSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Wie lange dauert die Verarbeitung eines Podcasts?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Die Verarbeitung dauert in der Regel nur wenige Minuten. Sie erhalten eine Benachrichtigung, sobald Ihr Artikel fertig ist.",
        },
      },
      {
        "@type": "Question",
        name: "Kann ich die generierten Artikel anpassen?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ja, Sie können alle generierten Inhalte nach Belieben bearbeiten und an Ihre Bedürfnisse anpassen.",
        },
      },
      {
        "@type": "Question",
        name: "Welche Podcast-Formate werden unterstützt?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Wir unterstützen alle gängigen Audio-Formate wie MP3, WAV, M4A und mehr.",
        },
      },
      {
        "@type": "Question",
        name: "Ist mein Content sicher?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ja, wir sind DSGVO-konform und Ihre Daten werden sicher auf deutschen Servern gehostet.",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * SoftwareApplication Schema - Produkt-Beschreibung
 */
export function SoftwareApplicationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EchoScribe",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: "0",
      highPrice: "149",
      offerCount: "3",
      offers: [
        {
          "@type": "Offer",
          name: "Starter",
          price: "0",
          priceCurrency: "EUR",
        },
        {
          "@type": "Offer",
          name: "Professional",
          price: "49",
          priceCurrency: "EUR",
        },
        {
          "@type": "Offer",
          name: "Business",
          price: "149",
          priceCurrency: "EUR",
        },
      ],
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: "1",
    },
    description: siteConfig.description,
    url: siteConfig.url,
    screenshot: `${siteConfig.url}/screenshot.png`,
    featureList: [
      "Automatische Transkription von Podcasts",
      "SEO-optimierte Blog-Artikel",
      "Meta-Tags und Keywords",
      "Schema.org Integration",
      "Social Media Posts für LinkedIn, Twitter, Instagram, Facebook",
      "Show Notes Generierung",
      "DSGVO-konform",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
