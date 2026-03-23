import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zimestimate.co.zw';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/home',
          '/marketplace',
          '/market-insights',
          '/quick-projects',
          '/marketplace/suppliers',
          '/privacy',
          '/terms',
          '/support',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/analytics',
          '/auth/',
          '/boq/new',
          '/dashboard',
          '/export',
          '/notifications',
          '/offline',
          '/projects',
          '/scraper',
          '/settings',
          '/supplier/',
          '/upgrade',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
