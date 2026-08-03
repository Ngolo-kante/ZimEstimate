import { getSiteUrl } from '@/lib/siteUrl';
import type { MetadataRoute } from 'next';

const siteUrl = getSiteUrl();

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
