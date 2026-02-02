'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { Currency } from '@/lib/database.types';
import {
    User,
    CurrencyDollar,
    Lock,
    Bell,
    Palette,
    Crown,
    Check,
    CaretRight,
    EnvelopeSimple,
    ShieldCheck,
} from '@phosphor-icons/react';
import Link from 'next/link';

function SettingsContent() {
    const { user, profile, updateProfile, isLoading: authLoading } = useAuth();
    const { success, error: showError } = useToast();

    // Profile form state
    const [fullName, setFullName] = useState('');
    const [preferredCurrency, setPreferredCurrency] = useState<Currency>('USD');
    const [isSaving, setIsSaving] = useState(false);

    // Password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Initialize form with profile data
    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setPreferredCurrency(profile.preferred_currency || 'USD');
        }
    }, [profile]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        const { error } = await updateProfile({
            full_name: fullName,
            preferred_currency: preferredCurrency,
        });

        if (error) {
            showError('Failed to update profile. Please try again.');
        } else {
            success('Profile updated successfully');
        }
        setIsSaving(false);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            showError('New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            showError('Password must be at least 8 characters');
            return;
        }

        setIsChangingPassword(true);

        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                showError(error.message);
            } else {
                success('Password changed successfully');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (err) {
            showError('An error occurred. Please try again.');
        }

        setIsChangingPassword(false);
    };

    if (authLoading) {
        return (
            <MainLayout title="Settings">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading settings...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout title="Settings">
            <div className="settings-page">
                {/* Profile Section */}
                <Card className="settings-card">
                    <CardHeader>
                        <div className="section-header">
                            <User size={24} weight="light" />
                            <CardTitle>Profile</CardTitle>
                        </div>
                    </CardHeader>

                    <div className="settings-content">
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <div className="input-with-icon readonly">
                                <EnvelopeSimple size={18} />
                                <input
                                    type="email"
                                    id="email"
                                    value={user?.email || ''}
                                    disabled
                                />
                            </div>
                            <p className="field-hint">Email cannot be changed</p>
                        </div>

                        <div className="form-group">
                            <label htmlFor="fullName">Full Name</label>
                            <input
                                type="text"
                                id="fullName"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                            />
                        </div>

                        <Button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </Card>

                {/* Currency Preference */}
                <Card className="settings-card">
                    <CardHeader>
                        <div className="section-header">
                            <CurrencyDollar size={24} weight="light" />
                            <CardTitle>Currency Preference</CardTitle>
                        </div>
                    </CardHeader>

                    <div className="settings-content">
                        <p className="section-description">
                            Choose your preferred currency for displaying prices throughout the app.
                        </p>

                        <div className="currency-options">
                            <button
                                className={`currency-option ${preferredCurrency === 'USD' ? 'active' : ''}`}
                                onClick={() => setPreferredCurrency('USD')}
                            >
                                <div className="currency-info">
                                    <span className="currency-code">USD</span>
                                    <span className="currency-name">US Dollar</span>
                                </div>
                                {preferredCurrency === 'USD' && <Check size={20} weight="bold" />}
                            </button>

                            <button
                                className={`currency-option ${preferredCurrency === 'ZWG' ? 'active' : ''}`}
                                onClick={() => setPreferredCurrency('ZWG')}
                            >
                                <div className="currency-info">
                                    <span className="currency-code">ZWG</span>
                                    <span className="currency-name">Zimbabwe Gold</span>
                                </div>
                                {preferredCurrency === 'ZWG' && <Check size={20} weight="bold" />}
                            </button>
                        </div>

                        <Button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save Preference'}
                        </Button>
                    </div>
                </Card>

                {/* Password Section */}
                <Card className="settings-card">
                    <CardHeader>
                        <div className="section-header">
                            <Lock size={24} weight="light" />
                            <CardTitle>Security</CardTitle>
                        </div>
                    </CardHeader>

                    <div className="settings-content">
                        <form onSubmit={handleChangePassword}>
                            <div className="form-group">
                                <label htmlFor="newPassword">New Password</label>
                                <input
                                    type="password"
                                    id="newPassword"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    minLength={8}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm New Password</label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    minLength={8}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isChangingPassword || !newPassword || !confirmPassword}
                            >
                                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                            </Button>
                        </form>
                    </div>
                </Card>

                {/* Subscription Section */}
                <Card className="settings-card">
                    <CardHeader>
                        <div className="section-header">
                            <Crown size={24} weight="light" />
                            <CardTitle>Subscription</CardTitle>
                        </div>
                    </CardHeader>

                    <div className="settings-content">
                        <div className="subscription-info">
                            <div className="current-plan">
                                <span className="plan-label">Current Plan</span>
                                <span className={`plan-badge ${profile?.tier}`}>
                                    {profile?.tier === 'pro' ? 'Pro' : profile?.tier === 'admin' ? 'Admin' : 'Free'}
                                </span>
                            </div>

                            {profile?.tier === 'free' && (
                                <div className="plan-features">
                                    <h4>Free Plan Includes:</h4>
                                    <ul>
                                        <li><Check size={16} /> Up to 3 projects</li>
                                        <li><Check size={16} /> Basic PDF export</li>
                                        <li><Check size={16} /> Material price database</li>
                                    </ul>
                                </div>
                            )}

                            {profile?.tier === 'pro' && (
                                <div className="plan-features">
                                    <h4>Pro Plan Includes:</h4>
                                    <ul>
                                        <li><Check size={16} /> Unlimited projects</li>
                                        <li><Check size={16} /> AI-powered features</li>
                                        <li><Check size={16} /> Advanced PDF export</li>
                                        <li><Check size={16} /> Priority support</li>
                                    </ul>
                                </div>
                            )}

                            {profile?.tier === 'free' && (
                                <Link href="/upgrade">
                                    <Button icon={<Crown size={18} />}>
                                        Upgrade to Pro
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Account Actions */}
                <Card className="settings-card danger-zone">
                    <CardHeader>
                        <div className="section-header">
                            <ShieldCheck size={24} weight="light" />
                            <CardTitle>Account</CardTitle>
                        </div>
                    </CardHeader>

                    <div className="settings-content">
                        <div className="account-action">
                            <div>
                                <h4>Export Your Data</h4>
                                <p>Download all your project data in JSON format</p>
                            </div>
                            <Button variant="secondary">
                                Export Data
                            </Button>
                        </div>

                        <div className="account-action danger">
                            <div>
                                <h4>Delete Account</h4>
                                <p>Permanently delete your account and all associated data</p>
                            </div>
                            <Button variant="ghost" className="danger-btn">
                                Delete Account
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <style jsx>{`
                .settings-page {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                    max-width: 800px;
                }

                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    gap: var(--spacing-md);
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid var(--color-border);
                    border-top-color: var(--color-primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .loading-state p {
                    color: var(--color-text-secondary);
                    margin: 0;
                }

                :global(.settings-card) {
                    overflow: hidden;
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    color: var(--color-text);
                }

                .settings-content {
                    padding: var(--spacing-lg);
                    padding-top: 0;
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .section-description {
                    color: var(--color-text-secondary);
                    margin: 0;
                    font-size: 0.875rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xs);
                }

                .form-group label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--color-text);
                }

                .form-group input {
                    padding: var(--spacing-sm) var(--spacing-md);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    font-size: 0.9375rem;
                    background: var(--color-surface);
                    color: var(--color-text);
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(20, 33, 61, 0.1);
                }

                .form-group input:disabled {
                    background: var(--color-background);
                    color: var(--color-text-secondary);
                    cursor: not-allowed;
                }

                .input-with-icon {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm) var(--spacing-md);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                }

                .input-with-icon.readonly {
                    background: var(--color-background);
                }

                .input-with-icon input {
                    border: none;
                    padding: 0;
                    flex: 1;
                    background: transparent;
                }

                .input-with-icon input:focus {
                    box-shadow: none;
                }

                .field-hint {
                    font-size: 0.75rem;
                    color: var(--color-text-muted);
                    margin: 0;
                }

                .currency-options {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                }

                .currency-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: var(--spacing-md);
                    border: 2px solid var(--color-border);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .currency-option:hover {
                    border-color: var(--color-primary);
                }

                .currency-option.active {
                    border-color: var(--color-primary);
                    background: rgba(20, 33, 61, 0.05);
                }

                .currency-option.active :global(svg) {
                    color: var(--color-primary);
                }

                .currency-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    text-align: left;
                }

                .currency-code {
                    font-weight: 600;
                    color: var(--color-text);
                }

                .currency-name {
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                }

                .subscription-info {
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-lg);
                }

                .current-plan {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                .plan-label {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }

                .plan-badge {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: var(--radius-sm);
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .plan-badge.free {
                    background: var(--color-border-light);
                    color: var(--color-text-secondary);
                }

                .plan-badge.pro {
                    background: var(--color-accent);
                    color: var(--color-primary);
                }

                .plan-badge.admin {
                    background: var(--color-primary);
                    color: var(--color-text-inverse);
                }

                .plan-features h4 {
                    margin: 0 0 var(--spacing-sm) 0;
                    font-size: 0.875rem;
                    color: var(--color-text);
                }

                .plan-features ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-xs);
                }

                .plan-features li {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    font-size: 0.875rem;
                    color: var(--color-text-secondary);
                }

                .plan-features li :global(svg) {
                    color: var(--color-success);
                }

                .account-action {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing-md);
                    background: var(--color-background);
                    border-radius: var(--radius-md);
                }

                .account-action h4 {
                    margin: 0;
                    font-size: 0.9375rem;
                }

                .account-action p {
                    margin: var(--spacing-xs) 0 0 0;
                    font-size: 0.75rem;
                    color: var(--color-text-secondary);
                }

                .account-action.danger {
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }

                .account-action.danger h4 {
                    color: var(--color-error);
                }

                :global(.danger-btn) {
                    color: var(--color-error) !important;
                }

                :global(.danger-btn:hover) {
                    background: rgba(239, 68, 68, 0.1) !important;
                }

                @media (max-width: 600px) {
                    .account-action {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: var(--spacing-md);
                    }
                }
            `}</style>
        </MainLayout>
    );
}

export default function SettingsPage() {
    return (
        <ProtectedRoute>
            <SettingsContent />
        </ProtectedRoute>
    );
}
