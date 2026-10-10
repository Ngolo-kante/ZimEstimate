import { getSiteUrl } from '@/lib/siteUrl';
import type { MetadataRoute } from 'next';

const siteUrl = getSiteUrl();

const publicRoutes = [
  '/',
  '/home',
  '/cost-to-build-a-house-in-zimbabwe',
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
    changeFrequency: route === '/home' || route === '/marketplace' || route === '/market-insights' || route === '/cost-to-build-a-house-in-zimbabwe' ? 'weekly' : 'monthly',
    priority: route === '/' || route === '/home' ? 1 : route === '/cost-to-build-a-house-in-zimbabwe' ? 0.9 : 0.7,
  }));
}
