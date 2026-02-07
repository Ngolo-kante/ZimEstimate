'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Envelope, Lock, User, GoogleLogo, Buildings, CheckCircle } from '@phosphor-icons/react';
import { useAuth } from '@/components/providers/AuthProvider';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function SignupPage() {
    const { signUp, signInWithGoogle, isLoading } = useAuth();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Validate password strength
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsSubmitting(true);

        const { error: signUpError } = await signUp(email, password, fullName);

        if (signUpError) {
            setError(signUpError.message);
            setIsSubmitting(false);
        } else {
            setSuccess(true);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
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

    // Success state
    if (success) {
        return (
            <>
                <div className="auth-page">
                    <div className="auth-container">
                        <div className="success-content">
                            <CheckCircle size={64} weight="duotone" className="success-icon" />
                            <h1>Check your email</h1>
                            <p>
                                We&apos;ve sent a confirmation link to <strong>{email}</strong>.
                                Click the link to activate your account.
                            </p>
                            <Link href="/auth/login">
                                <Button variant="secondary" fullWidth>
                                    Back to Sign In
                                </Button>
                            </Link>
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

                    .success-content {
                        text-align: center;
                    }

                    .success-content :global(.success-icon) {
                        color: var(--color-success);
                        margin-bottom: var(--spacing-md);
                    }

                    .success-content h1 {
                        font-size: 1.5rem;
                        font-weight: 600;
                        color: var(--color-text);
                        margin-bottom: var(--spacing-sm);
                    }

                    .success-content p {
                        color: var(--color-text-secondary);
                        margin-bottom: var(--spacing-lg);
                        line-height: 1.6;
                    }

                    .success-content strong {
                        color: var(--color-text);
                    }
                `}</style>
            </>
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
                        <h1>Create your account</h1>
                        <p>Start building smarter estimates today</p>
                    </div>

                    {/* Error Messages */}
                    {error && (
                        <div className="error-alert">
                            {error}
                        </div>
                    )}

                    {/* Google Sign Up */}
                    <button
                        type="button"
                        className="google-btn"
                        onClick={handleGoogleSignIn}
                    >
                        <GoogleLogo size={20} weight="bold" />
                        Continue with Google
                    </button>

                    <div className="divider">
                        <span>or sign up with email</span>
                    </div>

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        <Input
                            type="text"
                            label="Full Name"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            icon={<User size={18} />}
                            required
                        />

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
                            placeholder="At least 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            icon={<Lock size={18} />}
                            required
                        />

                        <Input
                            type="password"
                            label="Confirm Password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            icon={<Lock size={18} />}
                            required
                        />

                        <Button
                            type="submit"
                            fullWidth
                            loading={isSubmitting}
                            disabled={isSubmitting}
                        >
                            Create Account
                        </Button>
                    </form>

                    {/* Free Tier Info */}
                    <div className="tier-info">
                        <h3>Free tier includes:</h3>
                        <ul>
                            <li>Up to 3 projects</li>
                            <li>Basic PDF export</li>
                            <li>Access to material catalog</li>
                        </ul>
                    </div>

                    {/* Footer Links */}
                    <div className="auth-footer">
                        <p>
                            Already have an account?{' '}
                            <Link href="/auth/login">Sign in</Link>
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

                .tier-info {
                    margin-top: var(--spacing-lg);
                    padding: var(--spacing-md);
                    background: var(--color-bg-secondary);
                    border-radius: var(--radius-md);
                }

                .tier-info h3 {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: var(--spacing-xs);
                }

                .tier-info ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .tier-info li {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                    padding: var(--spacing-xs) 0;
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                }

                .tier-info li::before {
                    content: '\\2713';
                    color: var(--color-success);
                    font-weight: bold;
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
