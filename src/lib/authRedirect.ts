const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Return a canonical same-origin path suitable for post-auth navigation.
 * Absolute URLs, protocol-relative URLs, backslashes, and script schemes are
 * rejected rather than repaired so every auth flow has the same behavior.
 */
export function sanitizeAuthRedirect(value: string | null | undefined): string | null {
  if (!value || CONTROL_CHARACTERS.test(value) || value.includes('\\')) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;

  try {
    const base = new URL('https://auth-redirect.invalid');
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
