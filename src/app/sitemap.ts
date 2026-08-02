import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zimestimate.com';

const publicRoutes = [
  '/',
  '/home',
  '/marketplace',
  '/marketplace/suppliers',
  '/market-insights',
  '/quick-projects',
  '/privacy',
  '/terms',
  '/support',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route === '/' ? '' : route}`,
    lastModified: now,
    changeFrequency: route === '/home' || route === '/marketplace' || route === '/market-insights' ? 'weekly' : 'monthly',
    priority: route === '/' || route === '/home' ? 1 : 0.7,
  }));
}
