'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleLogo } from '@phosphor-icons/react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  createNoncePair,
  getGoogleClientId,
  loadGoogleIdentity,
  type GoogleCredentialResponse,
} from '@/lib/googleIdentity';

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
  className = 'google-btn',
}: GoogleSignInButtonProps) {
  const { signInWithGoogle, signInWithGoogleIdToken } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(!getGoogleClientId());
  const [isWorking, setIsWorking] = useState(false);

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
            const { error } = await signInWithGoogleIdToken(response.credential, raw);

            if (error) {
              onError?.(error.message);
              setIsWorking(false);
              return;
            }

            // Full navigation, not router.push — the session lands in storage
            // and every server component needs to see it.
            window.location.href = redirectTo;
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: containerRef.current.offsetWidth || 320,
        });
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
  }, [onError, redirectTo, signInWithGoogleIdToken]);

  // Styles live here rather than on the pages: styled-jsx scopes to the
  // component that declares it, so the .google-btn rules on the login and
  // signup pages stop applying the moment the button moves into this file.
  const styles = (
    <style jsx>{`
      .google-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-sm);
        padding: 0.75rem;
        font-size: 0.9375rem;
        font-weight: 500;
        font-family: inherit;
        background: white;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.2s ease;
        color: #333;
      }

      .google-btn:hover:not(:disabled) {
        background: var(--color-bg-secondary);
        border-color: var(--color-primary);
      }

      .google-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* Google renders its own iframe button; centre it and let it fill the
         column so it lines up with the email form below. */
      .google-gsi {
        width: 100%;
        min-height: 44px;
        display: flex;
        justify-content: center;
      }
    `}</style>
  );

  if (useFallback) {
    return (
      <>
        <button type="button" className={className} onClick={handleFallback} disabled={isWorking}>
          <GoogleLogo size={20} weight="bold" />
          Continue with Google
        </button>
        {styles}
      </>
    );
  }

  return (
    <>
      <div ref={containerRef} className="google-gsi" aria-busy={isWorking} />
      {styles}
    </>
  );
}
