import { Metadata } from 'next'

export const siteConfig = {
  name: 'EchoScribe',
  description: 'Automatically convert podcasts into SEO-optimized blog articles',
  url: process.env.NEXT_PUBLIC_BASE_URL || 'https://echoscribes.com',
  locale: 'en_US',
  type: 'website',
}

export function createMetadata({
  title,
  description = siteConfig.description,
  path = '',
  noIndex = false,
}: {
  title: string
  description?: string
  path?: string
  noIndex?: boolean
}): Metadata {
  const url = `${siteConfig.url}${path}`

  return {
    title,
    description,
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
