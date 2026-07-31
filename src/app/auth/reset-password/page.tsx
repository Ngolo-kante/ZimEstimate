'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Buildings } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Phase = 'verifying' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [phase, setPhase] = useState<Phase>('verifying');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Establish the recovery session the emailed link carries. Supabase sends
    // one of three shapes depending on project and email-template config:
    // ?code= (PKCE), ?token_hash=&type=recovery, or #access_token=&refresh_token=
    // (implicit). Each is consumed explicitly rather than leaning on the
    // client's detectSessionInUrl, which ignores an implicit hash when the
    // client is on its default PKCE flow type — that combination silently
    // yields no session and shows the user a false "link expired".
    //
    // This route deliberately does not reuse /auth/callback: that page routes
    // straight to a dashboard on success, which would drop the user past the
    // password form with a live session and no new password set.
    useEffect(() => {
        let active = true;

        const establishSession = async () => {
            const url = new URL(window.location.href);
            const params = url.searchParams;
            const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

            if (params.get('error') || hash.get('error')) {
                console.error('Recovery link error:', params.get('error_description') || hash.get('error_description'));
                if (active) setPhase('invalid');
                return;
            }

            const finish = (ok: boolean) => {
                if (!active) return;
                // Drop the tokens from the address bar once consumed so they do
                // not linger in history or get copied out of the URL.
                window.history.replaceState({}, '', '/auth/reset-password');
                setPhase(ok ? 'ready' : 'invalid');
            };

            const code = params.get('code');
            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                finish(!exchangeError);
                return;
            }

            const tokenHash = params.get('token_hash');
            if (tokenHash) {
                const { error: otpError } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: 'recovery',
                });
                finish(!otpError);
                return;
            }

            const accessToken = hash.get('access_token');
            const refreshToken = hash.get('refresh_token');
            if (accessToken && refreshToken) {
                const { error: setError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                finish(!setError);
                return;
            }

            // No link material in the URL. A session may still exist if the
            // client consumed the hash before this effect ran.
            const { data: { session } } = await supabase.auth.getSession();
            if (!active) return;
            setPhase(session ? 'ready' : 'invalid');
        };

        establishSession();
        return () => { active = false; };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setIsSubmitting(true);
        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
            setError(updateError.message);
            setIsSubmitting(false);
            return;
        }

        // The recovery session is a live session. Sign out so the new password
        // has to be used at least once, rather than leaving whoever opened the
        // emailed link signed in on this device.
        await supabase.auth.signOut();
        setPhase('done');
        setIsSubmitting(false);
        setTimeout(() => router.push('/auth/login'), 2500);
    };

    return (
        <>
            <div className="auth-page">
                <div className="auth-container">
                    <div className="auth-header">
                        <Link href="/home" className="logo">
                            <Buildings size={40} weight="duotone" />
                            <span className="logo-text">ZimEstimate</span>
                        </Link>
                        <h1>
                            {phase === 'done'
                                ? 'Password updated'
                                : phase === 'invalid'
                                    ? 'Link expired'
                                    : 'Choose a new password'}
                        </h1>
                        <p>
                            {phase === 'done'
                                ? 'You can now sign in with your new password. Taking you to sign in...'
                                : phase === 'invalid'
                                    ? 'This reset link is invalid or has already been used. Reset links expire one hour after they are sent.'
                                    : 'Pick something you have not used on this account before.'}
                        </p>
                    </div>

                    {error && <div className="error-alert">{error}</div>}

                    {phase === 'verifying' && (
                        <div className="verifying">
                            <div className="spinner" />
                            <span>Checking your reset link...</span>
                        </div>
                    )}

                    {phase === 'invalid' && (
                        <div className="auth-footer">
                            <p>
                                <Link href="/auth/forgot-password">Request a new link</Link>
                            </p>
                        </div>
                    )}

                    {phase === 'ready' && (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <Input
                                type="password"
                                label="New password"
                                placeholder="At least 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={<Lock size={18} />}
                                autoComplete="new-password"
                                required
                            />

                            <Input
                                type="password"
                                label="Confirm new password"
                                placeholder="Re-enter your new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                icon={<Lock size={18} />}
                                autoComplete="new-password"
                                required
                            />

                            <Button type="submit" fullWidth loading={isSubmitting} disabled={isSubmitting}>
                                Update password
                            </Button>
                        </form>
                    )}

                    {phase === 'done' && (
                        <div className="auth-footer">
                            <p>
                                <Link href="/auth/login">Go to sign in now</Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .auth-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-lg);
                    background: linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%);
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

                .auth-header :global(.logo) {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    color: var(--color-primary);
                    text-decoration: none;
                    margin-bottom: var(--spacing-md);
                }

                .logo-text {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--color-text);
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
                    line-height: 1.5;
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

                .verifying {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing-sm);
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                    padding: var(--spacing-md) 0;
                }

                .spinner {
                    width: 1.25rem;
                    height: 1.25rem;
                    border: 2px solid var(--color-border);
                    border-bottom-color: var(--color-primary);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                @media (prefers-reduced-motion: reduce) {
                    .spinner { animation-duration: 2.4s; }
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-md);
                }

                .auth-footer {
                    margin-top: var(--spacing-lg);
                    text-align: center;
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }

                .auth-footer :global(a) {
                    color: var(--color-primary);
                    text-decoration: none;
                    font-weight: 500;
                }

                .auth-footer :global(a:hover) {
                    text-decoration: underline;
                }
            `}</style>
        </>
    );
}
