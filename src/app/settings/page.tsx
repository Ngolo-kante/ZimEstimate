'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { Currency } from '@/lib/database.types';
import {
    User,
    CurrencyDollar,
    Lock,
    Crown,
    Check,
    EnvelopeSimple,
    Phone,
    CaretRight,
    WarningCircle
} from '@phosphor-icons/react';
import Link from 'next/link';

function SettingsContent() {
    const { user, profile, updateProfile, isLoading: authLoading } = useAuth();
    const { success, error: showError } = useToast();

    // Profile form state
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [preferredCurrency, setPreferredCurrency] = useState<Currency>('USD');
    const [isSaving, setIsSaving] = useState(false);

    // Password form state
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Initialize form with profile data
    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setPhoneNumber(profile.phone_number || '');
            setPreferredCurrency(profile.preferred_currency || 'USD');
        }
    }, [profile]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        const { error } = await updateProfile({
            full_name: fullName,
            phone_number: phoneNumber || null,
            preferred_currency: preferredCurrency,
        });

        if (error) {
            showError('Failed to update profile.');
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
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch {
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
            <div className="settings-container">
                <div className="settings-header">
                    <div>
                        <h1>Account Settings</h1>
                        <p>Manage your profile, preferences, and security settings.</p>
                    </div>
                </div>

                <div className="settings-grid">
                    {/* Profile Section */}
                    <div className="settings-card">
                        <div className="card-header">
                            <div className="header-icon user">
                                <User size={20} weight="bold" />
                            </div>
                            <div>
                                <h3>Personal Information</h3>
                                <p>Update your personal details.</p>
                            </div>
                        </div>

                        <div className="card-content">
                            <div className="form-group">
                                <label>Email Address</label>
                                <div className="input-box disabled">
                                    <EnvelopeSimple size={18} />
                                    <input type="email" value={user?.email || ''} disabled />
                                    <span className="badge">Verified</span>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Full Name</label>
                                    <div className="input-box">
                                        <User size={18} />
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Phone Number</label>
                                    <div className="input-box">
                                        <Phone size={18} />
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="+263..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="card-actions">
                                <Button onClick={handleSaveProfile} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Preferences & Security Grid */}
                    <div className="split-grid">
                        {/* Currency Preference */}
                        <div className="settings-card">
                            <div className="card-header">
                                <div className="header-icon currency">
                                    <CurrencyDollar size={20} weight="bold" />
                                </div>
                                <div>
                                    <h3>Currency</h3>
                                    <p>Select display currency.</p>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="currency-selector">
                                    <button
                                        className={`currency-option ${preferredCurrency === 'USD' ? 'active' : ''}`}
                                        onClick={() => setPreferredCurrency('USD')}
                                    >
                                        <span className="code">USD</span>
                                        <span className="name">US Dollar</span>
                                        {preferredCurrency === 'USD' && <Check size={16} weight="bold" />}
                                    </button>
                                    <button
                                        className={`currency-option ${preferredCurrency === 'ZWG' ? 'active' : ''}`}
                                        onClick={() => setPreferredCurrency('ZWG')}
                                    >
                                        <span className="code">ZWG</span>
                                        <span className="name">Zimbabwe Gold</span>
                                        {preferredCurrency === 'ZWG' && <Check size={16} weight="bold" />}
                                    </button>
                                </div>
                                <div className="card-actions">
                                    <Button onClick={handleSaveProfile} disabled={isSaving} variant="secondary">
                                        Update Currency
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Subscription */}
                        <div className="settings-card">
                            <div className="card-header">
                                <div className="header-icon premium">
                                    <Crown size={20} weight="bold" />
                                </div>
                                <div>
                                    <h3>Subscription</h3>
                                    <p>Manage your billing plan.</p>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="plan-summary">
                                    <div className="current-plan">
                                        <span className="label">Current Plan</span>
                                        <span className={`plan-badge ${profile?.tier}`}>
                                            {profile?.tier === 'pro' ? 'Pro' : profile?.tier === 'admin' ? 'Admin' : 'Free'}
                                        </span>
                                    </div>
                                    <p className="plan-description">
                                        {profile?.tier === 'pro'
                                            ? 'You have access to all premium features.'
                                            : 'Upgrade to unlock unlimited projects and AI estimates.'}
                                    </p>
                                    {profile?.tier === 'free' && (
                                        <Link href="/upgrade" className="upgrade-link">
                                            Upgrade Plan <CaretRight size={14} />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Password Section */}
                    <div className="settings-card">
                        <div className="card-header">
                            <div className="header-icon security">
                                <Lock size={20} weight="bold" />
                            </div>
                            <div>
                                <h3>Security</h3>
                                <p>Update your password.</p>
                            </div>
                        </div>
                        <div className="card-content">
                            <form onSubmit={handleChangePassword}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>New Password</label>
                                        <div className="input-box">
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Enter new password"
                                                minLength={8}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Confirm Password</label>
                                        <div className="input-box">
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm new password"
                                                minLength={8}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="card-actions">
                                    <Button
                                        type="submit"
                                        disabled={isChangingPassword || !newPassword || !confirmPassword}
                                        variant="secondary"
                                    >
                                        {isChangingPassword ? 'Updating...' : 'Update Password'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="settings-card danger">
                        <div className="card-header">
                            <div className="header-icon danger">
                                <WarningCircle size={20} weight="bold" />
                            </div>
                            <div>
                                <h3>Danger Zone</h3>
                                <p>Irreversible account actions.</p>
                            </div>
                        </div>
                        <div className="card-content">
                            <div className="danger-row">
                                <div>
                                    <h4>Delete Account</h4>
                                    <p>Permanently delete your account and all data.</p>
                                </div>
                                <Button variant="ghost" className="delete-btn">
                                    Delete Account
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .settings-container {
                    max-width: 900px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                    padding-bottom: 64px;
                }

                .settings-header h1 {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 0;
                    letter-spacing: -0.02em;
                }

                .settings-header p {
                    color: #64748b;
                    margin: 6px 0 0;
                    font-size: 1.05rem;
                }

                .settings-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .split-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }

                .settings-card {
                    background: #ffffff;
                    border-radius: 20px;
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -1px rgba(0, 0, 0, 0.01);
                    overflow: hidden;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .settings-card:hover {
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.02), 0 4px 6px -2px rgba(0, 0, 0, 0.01);
                    border-color: rgba(203, 213, 225, 0.8);
                }

                .card-header {
                    padding: 24px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    border-bottom: 1px solid #f8fafc;
                }

                .header-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .header-icon.user { background: #eff6ff; color: #3b82f6; }
                .header-icon.currency { background: #ecfdf5; color: #10b981; }
                .header-icon.premium { background: #fff7ed; color: #f59e0b; }
                .header-icon.security { background: #f1f5f9; color: #64748b; }
                .header-icon.danger { background: #fef2f2; color: #ef4444; }

                .card-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .card-header p {
                    margin: 2px 0 0;
                    font-size: 0.9rem;
                    color: #64748b;
                }

                .card-content {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .form-group label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .input-box {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background: #ffffff;
                    transition: all 0.2s;
                    position: relative;
                }

                .input-box:focus-within {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .input-box.disabled {
                    background: #f8fafc;
                    border-color: #f1f5f9;
                }

                .input-box svg {
                    color: #94a3b8;
                    flex-shrink: 0;
                }

                .input-box input {
                    border: none;
                    outline: none;
                    width: 100%;
                    font-size: 0.95rem;
                    color: #0f172a;
                    background: transparent;
                }

                .input-box input:disabled {
                    color: #64748b;
                    cursor: not-allowed;
                }

                .badge {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: #166534;
                    background: #dcfce7;
                    padding: 2px 8px;
                    border-radius: 99px;
                    text-transform: uppercase;
                    margin-left: auto;
                }

                .card-actions {
                    display: flex;
                    justify-content: flex-end;
                    padding-top: 8px;
                }

                /* Currency Selector */
                .currency-selector {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }

                .currency-option {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    padding: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background: #ffffff;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }

                .currency-option:hover {
                    border-color: #cbd5e1;
                    background: #f8fafc;
                }

                .currency-option.active {
                    border-color: #3b82f6;
                    background: #eff6ff;
                }

                .currency-option .code {
                    font-weight: 700;
                    color: #0f172a;
                    font-size: 1rem;
                }

                .currency-option .name {
                    font-size: 0.8rem;
                    color: #64748b;
                }

                .currency-option svg {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    color: #2563eb;
                }

                /* Plan Summary */
                .plan-summary {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .current-plan {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .current-plan .label {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #475569;
                }

                .plan-badge {
                    padding: 4px 10px;
                    border-radius: 99px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .plan-badge.free { background: #f1f5f9; color: #64748b; }
                .plan-badge.pro { background: #eff6ff; color: #2563eb; }
                .plan-badge.admin { background: #fefce8; color: #b45309; }

                .plan-description {
                    font-size: 0.9rem;
                    color: #64748b;
                    line-height: 1.5;
                    margin: 0;
                }

                .upgrade-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #2563eb;
                    text-decoration: none;
                    margin-top: 4px;
                }

                .upgrade-link:hover {
                    text-decoration: underline;
                }

                /* Danger Zone */
                .settings-card.danger {
                    border-color: #fecaca;
                }
                
                .danger-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .danger-row h4 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #0f172a;
                }

                .danger-row p {
                    margin: 4px 0 0;
                    font-size: 0.85rem;
                    color: #64748b;
                }

                :global(.delete-btn) {
                    color: #ef4444 !important;
                    background: #fef2f2 !important;
                }
                
                :global(.delete-btn:hover) {
                    background: #fee2e2 !important;
                }

                @media (max-width: 768px) {
                    .split-grid, .form-row {
                        grid-template-columns: 1fr;
                    }
                    
                    .danger-row {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 16px;
                    }
                    
                    .danger-row button {
                        width: 100%;
                    }
                }
                
                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 80px 0;
                    gap: 16px;
                    color: #64748b;
                }
                
                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #e2e8f0;
                    border-top-color: #3b82f6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
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
