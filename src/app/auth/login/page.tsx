'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Envelope, Lock, GoogleLogo, Buildings } from '@phosphor-icons/react';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { signIn, signInWithGoogle, isLoading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const callbackError = searchParams.get('error');
    const redirect = searchParams.get('redirect');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        const { error: signInError } = await signIn(email, password);

        if (signInError) {
            setError(signInError.message);
            setIsSubmitting(false);
        } else {
            router.push(redirect || '/dashboard');
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        // Store redirect URL for the OAuth callback to pick up
        if (redirect) {
            try { sessionStorage.setItem('zimestimate_auth_redirect', redirect); } catch {}
        }
        const { error: googleError } = await signInWithGoogle();
        if (googleError) {
            setError(googleError.message);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
            </div>
        );
    }

    return (
        <>
            <div className="auth-page">
                <div className="auth-container">
                    {/* Logo & Header */}
                    <div className="auth-header">
                        <Link href="/home" className="logo">
                            <Buildings size={40} weight="duotone" />
                            <span className="logo-text">ZimEstimate</span>
                        </Link>
                        <h1>Welcome back</h1>
                        <p>Sign in to continue to your projects</p>
                    </div>

                    {/* Error Messages */}
                    {(error || callbackError) && (
                        <div className="error-alert">
                            {error || 'Authentication failed. Please try again.'}
                        </div>
                    )}

                    {/* Google Sign In */}
                    <button
                        type="button"
                        className="google-btn"
                        onClick={handleGoogleSignIn}
                    >
                        <GoogleLogo size={20} weight="bold" />
                        Continue with Google
                    </button>

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
                    </div>
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

                .logo {
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

                .google-btn:hover {
                    background: var(--color-bg-secondary);
                    border-color: var(--color-primary);
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

                .auth-footer {
                    margin-top: var(--spacing-lg);
                    text-align: center;
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }

                .auth-footer a {
                    color: var(--color-primary);
                    text-decoration: none;
                    font-weight: 500;
                }

                .auth-footer a:hover {
                    text-decoration: underline;
                }
            `}</style>
        </>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
