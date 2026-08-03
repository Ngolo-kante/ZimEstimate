/**
 * The canonical public origin, read defensively.
 *
 * Environment values are typed or pasted into dashboards by people, and
 * trailing whitespace there is invisible. NEXT_PUBLIC_SITE_URL was set to
 * "https://zimestimate.com\n" in production, which put a newline inside every
 * canonical URL, the sitemap and the CSRF allow-list — the last of which
 * rejected every POST from the real domain with "Invalid request origin".
 *
 * Nothing downstream should have to know that. Read the value through here.
 */
const FALLBACK_SITE_URL = 'https://zimestimate.com';

function clean(value: string | undefined): string | null {
  if (!value) return null;
  // Strip surrounding whitespace and any trailing slash, so the result
  // concatenates predictably and compares equal to an Origin header.
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || null;
}

export function getSiteUrl(): string {
  return clean(process.env.NEXT_PUBLIC_SITE_URL) ?? FALLBACK_SITE_URL;
}

/** Browser-safe: falls back to the current origin rather than a build-time guess. */
export function getBrowserSiteUrl(): string {
  return (
    clean(process.env.NEXT_PUBLIC_SITE_URL) ??
    (typeof window !== 'undefined' ? window.location.origin : FALLBACK_SITE_URL)
  );
}
