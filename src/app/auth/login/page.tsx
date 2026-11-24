'use client';

import AuthBrand from '@/components/auth/AuthBrand';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Envelope, Lock } from '@phosphor-icons/react';
import { useAuth } from '@/components/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { sanitizeAuthRedirect } from '@/lib/authRedirect';
import { describeCallbackError, isEmailNotConfirmedError } from '@/lib/authConfirmation';
import ResendConfirmation from '@/components/auth/ResendConfirmation';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { signIn, isLoading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Set when sign-in failed only because the address is not confirmed yet.
    const [unconfirmedEmail, setUnconfirmedEmail] = useState('');

    const callbackError = describeCallbackError(searchParams.get('error'));
    const redirect = sanitizeAuthRedirect(searchParams.get('redirect'));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setUnconfirmedEmail('');
        setIsSubmitting(true);

        const { error: signInError } = await signIn(email, password);

        if (signInError) {
            if (isEmailNotConfirmedError(signInError)) {
                setUnconfirmedEmail(email.trim());
                setError('Please confirm your email first. We sent you a link when you signed up.');
            } else {
                setError(signInError.message);
            }
            setIsSubmitting(false);
        } else {
            // Fetch profile to determine role-based redirect
            const { data: { user } } = await supabase.auth.getUser();
            let destination = redirect || '/home';
            if (user) {
                const { data: profileRaw } = await supabase
                    .from('profiles')
                    .select('tier, user_type')
                    .eq('id', user.id)
                    .single();
                const profile = profileRaw as { tier: string; user_type: string } | null;
                if (profile?.tier === 'admin' || profile?.user_type === 'admin') {
                    destination = redirect || '/admin';
                } else if (profile?.user_type === 'supplier') {
                    destination = redirect || '/supplier/dashboard';
                }
            }
            router.push(destination);
        }
    };

    // The redirect fallback inside GoogleSignInButton still round-trips through
    // /auth/callback, which reads this back out.
    useEffect(() => {
        if (!redirect) return;
        try { sessionStorage.setItem('zimestimate_auth_redirect', redirect); } catch { /* noop */ }
    }, [redirect]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
                <div className="animate-spin motion-reduce:animate-none rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
            </div>
        );
    }

    return (
        <>
            <div className="auth-page mobile-auth-canvas">
                <AuthBrand />
                <div className="auth-container">
                    {/* Logo & Header */}
                    <div className="auth-header">
                        <h1>Welcome back</h1>
                        <p>Sign in to continue to your projects</p>
                    </div>

                    {/* Error Messages */}
                    {(error || callbackError) && (
                        <div className="error-alert" role="alert">
                            {error || callbackError}
                        </div>
                    )}
                    {unconfirmedEmail && <div className="resend-wrap"><ResendConfirmation email={unconfirmedEmail} /></div>}

                    {/* Google Sign In */}
                    <GoogleSignInButton
                        redirectTo={redirect || '/dashboard'}
                        onError={(message) => setError(message)}
                    />

                    <div className="divider">
                        <span>or sign in with email</span>
                    </div>

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        <Input
                            type="email"
                            label="Email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            icon={<Envelope size={18} />}
                            required
                        />

                        <Input
                            type="password"
                            label="Password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            icon={<Lock size={18} />}
                            required
                        />

                        <div className="forgot-row">
                            <Link href="/auth/forgot-password">Forgot password?</Link>
                        </div>

                        <Button
                            type="submit"
                            fullWidth
                            loading={isSubmitting}
                            disabled={isSubmitting}
                        >
                            Sign In
                        </Button>
                    </form>

                    {/* Footer Links */}
                    <div className="auth-footer">
                        <p>
                            Don&apos;t have an account?{' '}
                            <Link href={`/auth/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>Sign up</Link>
                        </p>
                    <p className="contractor-cta"><Link href="/contractor/register">Register as a contractor</Link></p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .resend-wrap {
                    margin-bottom: var(--spacing-lg);
                }

                .auth-page {
                    min-height: 100dvh;
                    display: grid;
                    grid-template-columns: minmax(0, 400px);
                    align-content: center;
                    justify-content: center;
                    gap: 16px;
                    padding: var(--spacing-lg) var(--auth-gutter, var(--spacing-lg));
                    background: var(--auth-canvas, linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%));
                }

                .auth-container {
                    width: 100%;
                    max-width: 400px;
                    padding: var(--spacing-xl);
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-lg);
                }

                .auth-header {
                    text-align: center;
                    margin-bottom: var(--spacing-lg);
                }

                .auth-header h1 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--color-text);
                    margin-bottom: var(--spacing-xs);
                }

                .auth-header p {
                    color: var(--color-text-secondary);
                    font-size: 0.9375rem;
                }

                .error-alert {
                    padding: var(--spacing-sm) var(--spacing-md);
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: var(--radius-md);
                    color: var(--color-error);
                    font-size: 0.875rem;
                    margin-bottom: var(--spacing-md);
                }

                .divider {
                    display: flex;
                    align-items: center;
                    margin: var(--spacing-lg) 0;
                }

                .divider::before,
                .divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: var(--color-border);
                }

                .divider span {
                    padding: 0 var(--spacing-md);
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .forgot-row {
                    margin-top: calc(-1 * var(--spacing-xs));
                    text-align: right;
                }

                /* :global() is required for these links. styled-jsx scopes rules
                   by appending its class to each compound selector, and the
                   anchor that next/link renders never carries that class — so
                   an unwrapped descendant rule compiles but matches nothing. */
                .forgot-row :global(a) {
                    font-size: 0.8125rem;
                    color: var(--color-heading);
                    text-decoration: none;
                    font-weight: 500;
                }
                @media (hover: hover) and (pointer: fine) {
                    .forgot-row :global(a:hover) {
                        text-decoration: underline;
                }
                }

                .auth-footer {
                    margin-top: var(--spacing-lg);
                    text-align: center;
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }

                .auth-footer :global(a) {
                    color: var(--color-heading);
                    text-decoration: none;
                    font-weight: 500;
                }
                @media (hover: hover) and (pointer: fine) {
                    .auth-footer :global(a:hover) {
                        text-decoration: underline;
                }
                }
                @media (min-width: 900px) {
                    .auth-page { grid-template-columns: minmax(0, 440px) minmax(0, 520px); gap: 0; align-items: stretch; }
                    .auth-container { grid-column: 1; grid-row: 1; max-width: none; border-radius: 12px 0 0 12px; align-content: center; }
                    .auth-page :global(aside) { grid-column: 2; grid-row: 1; border-radius: 0 12px 12px 0; }
                }
                .contractor-cta :global(a) { color: var(--pw-ink-1d4ed8); display: inline-flex; align-items: center; min-height: 44px; }
                .contractor-cta :global(a:hover) { text-decoration: underline; }
            `}</style>
        </>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
                <div className="animate-spin motion-reduce:animate-none rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
