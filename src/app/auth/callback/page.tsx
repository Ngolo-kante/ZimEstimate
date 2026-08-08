'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { sanitizeAuthRedirect } from '@/lib/authRedirect';

export default function AuthCallbackPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Supabase email confirmation links may use:
                // 1. token_hash + type — the email template builds the link on
                //    OUR domain and we verify it here
                // 2. PKCE flow: ?code=... in the URL search params
                // 3. Implicit/hash flow: #access_token=... in the URL hash
                //
                // The Supabase client auto-detects hash fragments on init,
                // but we still need to handle the code exchange for PKCE.

                const url = new URL(window.location.href);
                const code = url.searchParams.get('code');
                const tokenHash = url.searchParams.get('token_hash');
                const otpType = url.searchParams.get('type');
                const errorParam = url.searchParams.get('error');
                const errorDescription = url.searchParams.get('error_description');

                if (errorParam) {
                    console.error('Auth callback error:', errorParam, errorDescription);
                    router.push(`/auth/login?error=${encodeURIComponent(errorDescription || 'callback_failed')}`);
                    return;
                }

                if (tokenHash) {
                    // Default Supabase templates link to {{ .ConfirmationURL }},
                    // which lives on the project's supabase.co host. An email
                    // sent from zimestimate.com whose only link points at an
                    // unrelated domain is the exact shape of a credential-
                    // phishing message, and Gmail flags it as dangerous.
                    // Templates that build the link from {{ .SiteURL }} and
                    // {{ .TokenHash }} keep sender and destination on the same
                    // domain; this verifies the token they carry.
                    const { error: otpError } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: (otpType as 'email' | 'signup' | 'invite' | 'magiclink' | 'recovery') || 'email',
                    });
                    if (otpError) {
                        console.error('Token verification error:', otpError);
                        router.push('/auth/login?error=callback_failed');
                        return;
                    }
                } else if (code) {
                    // PKCE code exchange
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) {
                        console.error('Code exchange error:', exchangeError);
                        router.push('/auth/login?error=callback_failed');
                        return;
                    }
                } else {
                    // Hash fragment flow — the Supabase client picks this up
                    // automatically via onAuthStateChange. Wait briefly for it.
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) {
                        console.error('No session found after callback');
                        router.push('/auth/login?error=no_session');
                        return;
                    }
                }

                // Successfully authenticated — determine redirect.
                // Mirrors the role-based routing in the password login flow so
                // OAuth users land on the right home screen too.
                let redirectUrl = '/home';
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: profileRaw } = await supabase
                            .from('profiles')
                            .select('tier, user_type')
                            .eq('id', user.id)
                            .single();
                        const profile = profileRaw as { tier: string; user_type: string } | null;
                        if (profile?.tier === 'admin' || profile?.user_type === 'admin') {
                            redirectUrl = '/admin/revenue';
                        } else if (profile?.user_type === 'supplier') {
                            redirectUrl = '/supplier/dashboard';
                        }
                    }
                } catch { /* fall back to /home */ }

                try {
                    const stored = sessionStorage.getItem('zimestimate_auth_redirect');
                    const safeRedirect = sanitizeAuthRedirect(stored);
                    if (safeRedirect) {
                        sessionStorage.removeItem('zimestimate_auth_redirect');
                        redirectUrl = safeRedirect;
                    } else if (stored) {
                        sessionStorage.removeItem('zimestimate_auth_redirect');
                    }
                } catch { /* sessionStorage unavailable */ }

                router.push(redirectUrl);
            } catch (err) {
                console.error('Unexpected auth callback error:', err);
                setError('Something went wrong during sign-in. Please try again.');
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
            <div className="text-center">
                {error ? (
                    <>
                        <p className="text-[var(--color-error)] mb-4">{error}</p>
                        <a
                            href="/auth/login"
                            className="text-[var(--color-primary)] underline"
                        >
                            Back to Sign In
                        </a>
                    </>
                ) : (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
                        <p className="text-[var(--color-text-secondary)]">
                            Completing sign in...
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
