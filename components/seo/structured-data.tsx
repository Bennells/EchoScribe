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
      availableLanguage: "English",
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
    inLanguage: "en-US",
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
        name: "How long does it take to process a podcast?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Processing typically takes just a few minutes. You'll receive a notification once your article is ready.",
        },
      },
      {
        "@type": "Question",
        name: "Can I customize the generated articles?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, you can edit all generated content as you wish and adapt it to your needs.",
        },
      },
      {
        "@type": "Question",
        name: "Which podcast formats are supported?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "We support all common audio formats such as MP3, WAV, M4A and more.",
        },
      },
      {
        "@type": "Question",
        name: "Is my content secure?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, we are GDPR compliant and your data is securely hosted on European servers.",
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
      "Automatic podcast transcription",
      "SEO-optimized blog articles",
      "Meta tags and keywords",
      "Schema.org integration",
      "Social media posts for LinkedIn, Twitter, Instagram, Facebook",
      "GDPR compliant",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
