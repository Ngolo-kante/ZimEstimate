'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  createNoncePair,
  getGoogleClientId,
  loadGoogleIdentity,
  type GoogleCredentialResponse,
} from '@/lib/googleIdentity';
import { sanitizeAuthRedirect } from '@/lib/authRedirect';
import css from './GoogleSignInButton.module.css';

/** Google's standard four-colour "G", as their branding guidelines require. */
function GoogleMark() {
  return (
    <svg className={css.mark} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * "Continue with Google" that keeps Google's sign-in screen on our own origin.
 *
 * Renders Google's own button when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, and
 * falls back to the previous Supabase redirect flow when it is not — so an
 * environment that has not been configured yet still signs people in, it just
 * shows the Supabase host while doing it. Anything that throws at any point
 * falls back the same way rather than leaving a dead button on the page.
 */

interface GoogleSignInButtonProps {
  /** Where to send the user once a session exists. */
  redirectTo?: string;
  onError?: (message: string) => void;
  className?: string;
}

export default function GoogleSignInButton({
  redirectTo = '/dashboard',
  onError,
  className,
}: GoogleSignInButtonProps) {
  const { signInWithGoogle, signInWithGoogleIdToken } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(!getGoogleClientId());
  const [isWorking, setIsWorking] = useState(false);
  const safeRedirectTo = sanitizeAuthRedirect(redirectTo) ?? '/dashboard';

  // Held in refs so the setup effect below does not depend on them.
  //
  // Callers pass onError as an inline arrow — onError={(m) => setError(m)} —
  // which is a new function on every render of the page. With it in the
  // dependency array, every keystroke in the email field tore down and rebuilt
  // Google's iframe button, so the page visibly flickered while typing and did
  // a fresh nonce generation per character. signInWithGoogleIdToken has the
  // same problem: it is recreated on every AuthProvider render.
  const onErrorRef = useRef(onError);
  const signInWithTokenRef = useRef(signInWithGoogleIdToken);
  useEffect(() => {
    onErrorRef.current = onError;
    signInWithTokenRef.current = signInWithGoogleIdToken;
  });

  // Redrawn when the column really changes width (narrowing the window,
  // turning a phone). The button took its width once, so after a resize it
  // stayed 392px wide on a 320px screen and pushed the page sideways.
  const renderButtonRef = useRef<(() => void) | null>(null);
  const renderedWidthRef = useRef(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const width = Math.max(200, Math.min(400, Math.floor(container.offsetWidth)));
        if (Math.abs(width - renderedWidthRef.current) >= 16) renderButtonRef.current?.();
      }, 200);
    });
    observer.observe(container);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  const handleFallback = useCallback(async () => {
    setIsWorking(true);
    const { error } = await signInWithGoogle();
    if (error) {
      onError?.(error.message);
      setIsWorking(false);
    }
  }, [onError, signInWithGoogle]);

  useEffect(() => {
    const clientId = getGoogleClientId();
    if (!clientId) return;

    let cancelled = false;

    const setup = async () => {
      try {
        const [{ raw, hashed }] = await Promise.all([createNoncePair(), loadGoogleIdentity()]);
        if (cancelled || !containerRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashed,
          cancel_on_tap_outside: true,
          callback: async (response: GoogleCredentialResponse) => {
            setIsWorking(true);
            // Supabase gets the raw nonce and hashes it to compare against the
            // hash Google embedded in the token.
            const { error } = await signInWithTokenRef.current(response.credential, raw);

            if (error) {
              onErrorRef.current?.(error.message);
              setIsWorking(false);
              return;
            }

            // Full navigation, not router.push — the session lands in storage
            // and every server component needs to see it.
            window.location.href = safeRedirectTo;
          },
        });

        renderButtonRef.current = () => {
          const container = containerRef.current;
          if (!container || !window.google) return;
          // Emptied first: StrictMode mounts, unmounts and remounts in
          // development, and renderButton appends rather than replaces, so
          // without this the dev build shows two Google buttons stacked.
          container.innerHTML = '';
          // Google accepts 200–400px.
          const width = Math.max(200, Math.min(400, Math.floor(container.offsetWidth || 320)));
          renderedWidthRef.current = width;
          window.google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width,
          });
        };
        renderButtonRef.current();
      } catch {
        // Script blocked, offline, or an unconfigured origin — the redirect
        // flow still works, so use it rather than showing nothing.
        if (!cancelled) setUseFallback(true);
      }
    };

    setup();
    return () => {
      cancelled = true;
    };
    // redirectTo only. Everything else the setup needs is read through a ref at
    // call time, so a parent re-rendering cannot rebuild Google's button.
  }, [safeRedirectTo]);

  if (useFallback) {
    return (
      <>
        <button
          type="button"
          className={className ? `${css.button} ${className}` : css.button}
          onClick={handleFallback}
          disabled={isWorking}
        >
          <GoogleMark />
          <span>Continue with Google</span>
        </button>
      </>
    );
  }

  return (
    <>
      <div ref={containerRef} className={css.gsi} aria-busy={isWorking} />
    </>
  );
}
