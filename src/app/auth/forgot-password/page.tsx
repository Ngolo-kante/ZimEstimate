'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Envelope, Buildings, CheckCircle } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        // Deliberately show the same confirmation whether or not the address has
        // an account. Reporting "no such user" here would turn this form into an
        // account-enumeration oracle. Rate-limit errors are still surfaced, since
        // silently swallowing those would leave the user waiting for an email
        // that Supabase never sent.
        if (resetError && resetError.status === 429) {
            setError('Too many requests. Please wait a minute and try again.');
            setIsSubmitting(false);
            return;
        }

        if (resetError) {
            console.error('Password reset request failed:', resetError);
        }

        setSent(true);
        setIsSubmitting(false);
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
                        <h1>{sent ? 'Check your email' : 'Reset your password'}</h1>
                        <p>
                            {sent
                                ? 'If an account exists for that address, we have sent a link to reset your password. The link expires in one hour.'
                                : 'Enter the email you signed up with and we will send you a reset link.'}
                        </p>
                    </div>

                    {error && <div className="error-alert">{error}</div>}

                    {sent ? (
                        <>
                            <div className="sent-note">
                                <CheckCircle size={20} weight="fill" />
                                <span>
                                    Nothing yet? Check your spam folder, or{' '}
                                    <button type="button" className="linkish" onClick={() => setSent(false)}>
                                        try a different address
                                    </button>
                                    .
                                </span>
                            </div>
                            <div className="auth-footer">
                                <p>
                                    <Link href="/auth/login">Back to sign in</Link>
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <form onSubmit={handleSubmit} className="auth-form">
                                <Input
                                    type="email"
                                    label="Email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    icon={<Envelope size={18} />}
                                    autoComplete="email"
                                    required
                                />

                                <Button type="submit" fullWidth loading={isSubmitting} disabled={isSubmitting}>
                                    Send reset link
                                </Button>
                            </form>

                            <div className="auth-footer">
                                <p>
                                    Remembered it? <Link href="/auth/login">Back to sign in</Link>
                                </p>
                            </div>
                        </>
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

                .sent-note {
                    display: flex;
                    gap: var(--spacing-sm);
                    align-items: flex-start;
                    padding: var(--spacing-md);
                    background: rgba(16, 185, 129, 0.08);
                    border: 1px solid rgba(16, 185, 129, 0.25);
                    border-radius: var(--radius-md);
                    color: var(--color-text-secondary);
                    font-size: 0.875rem;
                    line-height: 1.5;
                }

                .sent-note :global(svg) {
                    color: var(--color-success, #10b981);
                    flex-shrink: 0;
                    margin-top: 0.1rem;
                }

                .linkish {
                    background: none;
                    border: none;
                    padding: 0;
                    font: inherit;
                    color: var(--color-primary);
                    font-weight: 500;
                    cursor: pointer;
                    text-decoration: underline;
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
