'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            const { error } = await supabase.auth.exchangeCodeForSession(
                window.location.href
            );

            if (error) {
                console.error('Auth callback error:', error);
                router.push('/auth/login?error=callback_failed');
            } else {
                // Check for a stored redirect URL (from login/signup with ?redirect=)
                let redirectUrl = '/dashboard';
                try {
                    const stored = sessionStorage.getItem('zimestimate_auth_redirect');
                    if (stored) {
                        sessionStorage.removeItem('zimestimate_auth_redirect');
                        redirectUrl = stored;
                    }
                } catch {}
                router.push(redirectUrl);
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
                <p className="text-[var(--color-text-secondary)]">
                    Completing sign in...
                </p>
            </div>
        </div>
    );
}
