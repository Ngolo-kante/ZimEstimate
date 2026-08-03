// ─── Google Identity Services ─────────────────────────────────────────────────
// Signs in with Google without routing the user through Supabase's OAuth
// endpoint.
//
// Why: Supabase brokers OAuth from its own host, so Google's sign-in screen read
// "to continue to bjvnisdfkkhonjtytheb.supabase.co" — which looks like phishing
// on the highest-intent screen in the product. That string is the redirect_uri
// Supabase hands Google, and it is not configurable: GoTrue builds it from its
// own external URL and ignores X-Forwarded-Host, so no reverse proxy can change
// it. Supabase's paid custom-domain add-on fixes it; so does this, for free.
//
// Google Identity Services returns an ID token straight to the browser with no
// redirect at all, so Google shows our own origin. Supabase then accepts that
// token via signInWithIdToken and issues its own session, so everything
// downstream of sign-in is unchanged.

const GSI_SRC = 'https://accounts.google.com/gsi/client';

export interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: 'popup' | 'redirect';
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads the GSI script once, however many buttons ask for it. */
export function loadGoogleIdentity(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Not in a browser'));
  if (window.google?.accounts?.id) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google sign-in failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Let a later attempt retry rather than caching the failure forever.
        scriptPromise = null;
        reject(new Error('Google sign-in failed to load'));
      };
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

/**
 * Google is given the SHA-256 of the nonce and embeds it in the ID token;
 * Supabase is given the raw value and hashes it to compare. Sending the same
 * form to both fails the check, which is the usual way this is got wrong.
 */
export async function createNoncePair(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');

  return { raw, hashed };
}

export function getGoogleClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || undefined;
}
