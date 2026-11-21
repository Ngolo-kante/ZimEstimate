'use client';

import Switch from '@/components/ui/Switch';

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/shadcn/collapsible';
import { useState, useEffect, type ComponentType } from 'react';
import ReminderChannels from '@/components/settings/ReminderChannels';
import { useReminderChannels } from '@/hooks/useReminderChannels';
import MainLayout from '@/components/layout/MainLayout';
import Button from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/shadcn/field';
import { Input } from '@/components/shadcn/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/shadcn/tabs';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import groupStyles from '@/components/settings/settings-groups.module.css';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { Currency } from '@/lib/database.types';
import { getNotificationDeliveries } from '@/lib/services/notifications';
import type { NotificationDelivery } from '@/lib/database.types';
import {
    User,
    CurrencyDollar,
    Lock,
    Crown,
    EnvelopeSimple,
    Phone,
    CaretRight,
    WarningCircle,
    Bell,
    WhatsappLogo,
    DeviceMobile
} from '@phosphor-icons/react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function SettingsContent() {
    const { user, profile, updateProfile, isLoading: authLoading } = useAuth();
    const { success, error: showError } = useToast();
    const whatsappAvailable = useReminderChannels().includes('whatsapp');

    // Profile form state
    // Sections are tabs; the address says which one is open, so links such as
    // /settings#notifications (or the older #email anchor) open the right tab.
    const SECTION_TABS = ['profile', 'preferences', 'plan', 'notifications', 'security'];
    const [phone, setPhone] = useState(false);
    const [, setOpenCard] = useState('Personal information');
    // Phone: the five sections are collapsed rows (owner, 17 Nov), opened one or
    // more at a time; desktop keeps the tabs.
    const [openGroups, setOpenGroups] = useState<string[]>([]);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px)');
        const sync = () => setPhone(media.matches);
        sync(); media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);
    const [section, setSection] = useState('profile');
    useEffect(() => {
        const hash = window.location.hash.slice(1);
        const tab = hash === 'email' ? 'profile' : hash;
        if (SECTION_TABS.includes(tab)) {
            setSection(tab);
            setOpenGroups([tab]);
            setOpenCard(({ profile: 'Personal information', preferences: 'Currency', plan: 'Subscription', notifications: 'Notifications', security: 'Security' } as Record<string, string>)[tab]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Keep the open tab visible in the phone's sideways tab strip (the strip
    // scrolls, the page does not).
    useEffect(() => {
        const active = document.querySelector<HTMLElement>('.settings-nav [data-state="active"]');
        const list = active?.parentElement;
        if (!active || !list || list.scrollWidth <= list.clientWidth) return;
        const offset = active.getBoundingClientRect().left - list.getBoundingClientRect().left;
        list.scrollLeft += offset - 16;
    }, [section]);
    const openSection = (value: string) => {
        setSection(value);
        setOpenCard(({ profile: 'Personal information', preferences: 'Currency', plan: 'Subscription', notifications: 'Notifications', security: 'Security' } as Record<string, string>)[value]);
        window.history.replaceState(null, '', `#${value}`);
    };
    const toggleGroup = (id: string) => setOpenGroups(open => {
        const next = open.includes(id) ? open.filter(g => g !== id) : [...open, id];
        window.history.replaceState(null, '', next.includes(id) ? `#${id}` : window.location.pathname);
        return next;
    });
    // A parent row on a phone: the section name with a chevron that turns when open.
    const groupRow = (id: string, label: string, Icon: ComponentType<{ size?: number; weight?: 'duotone' }>) => phone ? (
        <button type="button" className={groupStyles.row} aria-expanded={openGroups.includes(id)} aria-controls={`group-${id}`} onClick={() => toggleGroup(id)}>
            <span aria-hidden="true" className={groupStyles.icon}><Icon size={20} weight="duotone" /></span>
            <span className={groupStyles.label}>{label}</span>
            <CaretRight size={18} className={groupStyles.caret} aria-hidden="true" />
        </button>
    ) : null;
    // On a phone every panel stays mounted and its row decides whether it shows.
    const groupProps = (id: string) => phone ? { forceMount: true as const, hidden: !openGroups.includes(id), id: `group-${id}` } : {};
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [preferredCurrency, setPreferredCurrency] = useState<Currency>('USD');
    const [isSaving, setIsSaving] = useState(false);

    // Notification preferences
    const [notifyEmail, setNotifyEmail] = useState(true);
    const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
    const [notifyPush, setNotifyPush] = useState(false);
    const [notifyRfq, setNotifyRfq] = useState(true);
    const [notifyQuoteUpdates, setNotifyQuoteUpdates] = useState(true);
    const [notifyPriceAlerts, setNotifyPriceAlerts] = useState(true);
    const [notifyProjectReminders, setNotifyProjectReminders] = useState(true);
    const [isSavingNotifications, setIsSavingNotifications] = useState(false);
    const [deliveryLogs, setDeliveryLogs] = useState<NotificationDelivery[]>([]);

    // Email change. Supabase sends a confirmation link (to the new address,
    // and to the current one when secure email change is on); the address
    // only changes once it is followed.
    const [editingEmail, setEditingEmail] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [isChangingEmail, setIsChangingEmail] = useState(false);
    const [pendingEmail, setPendingEmail] = useState<string | null>(null);
    const signsInWithGoogle = user?.app_metadata?.provider === 'google'
        || (Array.isArray(user?.app_metadata?.providers) && user.app_metadata.providers.includes('google') && !user.app_metadata.providers.includes('email'));

    const handleChangeEmail = async () => {
        const next = newEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
            showError('Enter a valid email address.');
            return;
        }
        if (next === (user?.email || '').toLowerCase()) {
            showError('That is already your email address.');
            return;
        }
        setIsChangingEmail(true);
        try {
            try { sessionStorage.setItem('zimestimate_auth_redirect', '/settings'); } catch { /* optional */ }
            const { error } = await supabase.auth.updateUser(
                { email: next },
                { emailRedirectTo: `${window.location.origin}/auth/callback` },
            );
            if (error) {
                showError(error.message);
                return;
            }
            setPendingEmail(next);
            setEditingEmail(false);
            setNewEmail('');
            success(`Check ${next} for a confirmation link.`);
        } finally {
            setIsChangingEmail(false);
        }
    };

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
            setNotifyEmail(profile.notify_email ?? true);
            setNotifyWhatsapp(profile.notify_whatsapp ?? false);
            setNotifyPush(profile.notify_push ?? false);
            setNotifyRfq(profile.notify_rfq ?? true);
            setNotifyQuoteUpdates(profile.notify_quote_updates ?? true);
            setNotifyPriceAlerts(profile.notify_price_alerts ?? true);
            setNotifyProjectReminders(profile.notify_project_reminders ?? true);
        }
    }, [profile]);

    useEffect(() => {
        if (!user) return;
        const loadDeliveries = async () => {
            const { deliveries } = await getNotificationDeliveries(user.id, 8);
            setDeliveryLogs(deliveries);
        };
        loadDeliveries();
    }, [user]);

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

    const handleSaveNotifications = async () => {
        if (!user) return;
        if (whatsappAvailable && notifyWhatsapp && !phoneNumber) {
            showError('Add a phone number to enable WhatsApp notifications.');
            return;
        }

        setIsSavingNotifications(true);
        const { error } = await updateProfile({
            notify_email: notifyEmail,
            notify_whatsapp: notifyWhatsapp,
            notify_push: notifyPush,
            notify_rfq: notifyRfq,
            notify_quote_updates: notifyQuoteUpdates,
            notify_price_alerts: notifyPriceAlerts,
            notify_project_reminders: notifyProjectReminders,
        });

        if (error) {
            showError('Failed to update notification preferences.');
        } else {
            success('Notification preferences updated');
        }
        setIsSavingNotifications(false);
    };

    const formatDeliveryTime = (timestamp: string) => {
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString();
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
            // The signed-in client. This used to build a fresh client with no
            // session, so every password change failed with "Auth session
            // missing".
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
            <MainLayout fullWidth>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading settings...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout fullWidth mobileNavy>
            <div className="settings-container">
                <header className="settings-header">
                    <div>
                        <h1>Settings</h1>
                        <p>Manage your account and preferences.</p>
                    </div>
                    <div className="settings-status" aria-label="Current account plan">
                        <span>Current plan</span>
                        <strong>{profile?.tier === 'pro' ? 'Pro' : profile?.tier === 'admin' ? 'Admin' : 'Free'}</strong>
                    </div>
                </header>

                <Tabs value={section} onValueChange={openSection} className="settings-layout">
                    <aside className="settings-sidebar">
                        <div className="account-summary">
                            <div className="account-avatar" aria-hidden="true">
                                <User size={23} weight="bold" />
                            </div>
                            <div>
                                <strong>{profile?.full_name || user?.email?.split('@')[0] || 'Your account'}</strong>
                                <span>{user?.email}</span>
                            </div>
                        </div>
                        <TabsList className="settings-nav" aria-label="Settings sections">
                            <TabsTrigger value="profile"><User size={17} />Profile</TabsTrigger>
                            <TabsTrigger value="preferences"><CurrencyDollar size={17} />Preferences</TabsTrigger>
                            <TabsTrigger value="plan"><Crown size={17} />Plan</TabsTrigger>
                            <TabsTrigger value="notifications"><Bell size={17} />Notifications</TabsTrigger>
                            <TabsTrigger value="security"><Lock size={17} />Security</TabsTrigger>
                        </TabsList>
                    </aside>

                    <div className="settings-grid">
                    {/* Profile Section */}
                    {groupRow('profile', 'Profile', User)}<TabsContent {...groupProps('profile')} value="profile" asChild><Collapsible open onOpenChange={open => setOpenCard(open ? 'Personal information' : '')} asChild><section className="settings-card">
                        <CollapsibleTrigger asChild disabled><button type="button" className="card-header accordion-heading">
                            <div className="header-icon user">
                                <User size={20} weight="bold" />
                            </div>
                            <div>
                                <h3>Personal information</h3>
                                <p>Update your personal details.</p>
                            </div>
                        </button></CollapsibleTrigger>

                        <CollapsibleContent asChild><div className="card-content">
                            <Field className="form-group" id="email">
                                <FieldLabel htmlFor="account-email">Email address</FieldLabel>
                                <div className="input-box disabled">
                                    <EnvelopeSimple size={18} />
                                    <Input id="account-email" type="email" value={user?.email || ''} disabled />
                                    <span className="badge">Verified</span>
                                </div>
                                {signsInWithGoogle ? (
                                    <p className="field-note">You sign in with Google, so this is your Google address. To use another, sign in with that Google account.</p>
                                ) : editingEmail ? (
                                    <div className="email-change">
                                        <div className="input-box">
                                            <EnvelopeSimple size={18} />
                                            <Input
                                                type="email"
                                                aria-label="New email address"
                                                value={newEmail}
                                                onChange={(e) => setNewEmail(e.target.value)}
                                                placeholder="New email address"
                                                autoComplete="email"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="email-change-actions">
                                            <Button variant="secondary" size="sm" onClick={() => { setEditingEmail(false); setNewEmail(''); }}>Cancel</Button>
                                            <Button size="sm" onClick={() => void handleChangeEmail()} disabled={isChangingEmail}>
                                                {isChangingEmail ? 'Sending…' : 'Send confirmation link'}
                                            </Button>
                                        </div>
                                        <p className="field-note">We&rsquo;ll email a link to the new address. Your email changes once you open it; you may also be asked to confirm from your current inbox.</p>
                                    </div>
                                ) : (
                                    <p className="field-note">
                                        {pendingEmail
                                            ? <>Waiting for you to confirm <strong>{pendingEmail}</strong> — open the link we emailed. </>
                                            : 'Reminders and notifications are sent here. '}
                                        <button type="button" className="text-link" onClick={() => setEditingEmail(true)}>Change email</button>
                                    </p>
                                )}
                            </Field>

                            <div className="form-row">
                                <Field className="form-group">
                                    <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                                    <div className="input-box">
                                        <User size={18} />
                                        <Input id="full-name"
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                </Field>

                                <Field className="form-group">
                                    <FieldLabel htmlFor="phone-number">Phone number</FieldLabel>
                                    <div className="input-box">
                                        <Phone size={18} />
                                        <Input id="phone-number"
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="+263..."
                                        />
                                    </div>
                                </Field>
                            </div>

                            <div className="card-actions">
                                <Button onClick={handleSaveProfile} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save changes'}
                                </Button>
                            </div>
                        </div></CollapsibleContent>
                    </section></Collapsible></TabsContent>

                    {/* Preferences & Security Grid */}
                    <div className="split-grid">
                        {/* Currency Preference */}
                        {groupRow('preferences', 'Preferences', CurrencyDollar)}<TabsContent {...groupProps('preferences')} value="preferences" asChild><Collapsible open onOpenChange={open => setOpenCard(open ? 'Currency' : '')} asChild><section className="settings-card">
                            <CollapsibleTrigger asChild disabled><button type="button" className="card-header accordion-heading">
                                <div className="header-icon currency">
                                    <CurrencyDollar size={20} weight="bold" />
                                </div>
                                <div>
                                    <h3>Currency</h3>

                                </div>
                            </button></CollapsibleTrigger>
                            <CollapsibleContent asChild><div className="card-content">
                                <p className="currency-note">Prices are shown in US dollars.</p>
                            </div></CollapsibleContent>
                        </section></Collapsible></TabsContent>

                        {/* Subscription */}
                        {groupRow('plan', 'Plan', Crown)}<TabsContent {...groupProps('plan')} value="plan" asChild><Collapsible open onOpenChange={open => setOpenCard(open ? 'Subscription' : '')} asChild><section className="settings-card">
                            <CollapsibleTrigger asChild disabled><button type="button" className="card-header accordion-heading">
                                <div className="header-icon premium">
                                    <Crown size={20} weight="bold" />
                                </div>
                                <div>
                                    <h3>Subscription</h3>
                                    <p>Manage your billing plan.</p>
                                </div>
                            </button></CollapsibleTrigger>
                            <CollapsibleContent asChild><div className="card-content">
                                <div className="plan-summary">
                                    <div className="current-plan">
                                        <span className="label">Current plan</span>
                                        <span className={`plan-badge ${profile?.tier || 'free'}`}>
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
                                            Upgrade plan <CaretRight size={14} />
                                        </Link>
                                    )}
                                </div>
                            </div></CollapsibleContent>
                        </section></Collapsible></TabsContent>
                    </div>

                    {/* Notification Preferences */}
                    {groupRow('notifications', 'Notifications', Bell)}<TabsContent {...groupProps('notifications')} value="notifications" className="settings-panel">
                        <Collapsible open onOpenChange={open => setOpenCard(open ? 'Notifications' : '')} asChild><section className="settings-card" id="notifications">
                            <CollapsibleTrigger asChild disabled><button type="button" className="card-header accordion-heading">
                                <div className="header-icon notification">
                                    <Bell size={20} weight="bold" />
                                </div>
                                <div>
                                    <h3>Notifications</h3>
                                    <p>Choose how you want to be alerted.</p>
                                </div>
                            </button></CollapsibleTrigger>
                            <CollapsibleContent asChild><div className="card-content">
                                <div className="toggle-group">
                                    <div className="toggle-row">
                                        <div>
                                            <span className="toggle-label">Email</span>
                                            <span className="toggle-hint">Quote requests, quotes and updates</span>
                                        </div>
                                        <Switch checked={notifyEmail} label="Email notifications" onCheckedChange={setNotifyEmail} />
                                    </div>
                                    {/* Only once WhatsApp can actually send (its provider settings
                                        are in place). Push notifications were listed here too, but
                                        nothing sends them yet, so the switch is hidden until
                                        something does. */}
                                    {whatsappAvailable && (
                                    <div className="toggle-row">
                                        <div>
                                            <span className="toggle-label">WhatsApp</span>
                                            <span className="toggle-hint">Instant alerts to your phone</span>
                                        </div>
                                        <Switch checked={notifyWhatsapp} label="WhatsApp notifications" onCheckedChange={setNotifyWhatsapp} />
                                    </div>
                                    )}
                                </div>

                                <div className="notification-section">
                                    <div className="section-title">What to notify me about</div>
                                    <div className="chip-grid">
                                        <button
                                            className={`chip ${notifyRfq ? 'active' : ''}`}
                                            onClick={() => setNotifyRfq(!notifyRfq)}
                                        >
                                            Quote requests
                                        </button>
                                        <button
                                            className={`chip ${notifyQuoteUpdates ? 'active' : ''}`}
                                            onClick={() => setNotifyQuoteUpdates(!notifyQuoteUpdates)}
                                        >
                                            Quote updates
                                        </button>
                                        <button
                                            className={`chip ${notifyPriceAlerts ? 'active' : ''}`}
                                            onClick={() => setNotifyPriceAlerts(!notifyPriceAlerts)}
                                        >
                                            Price alerts
                                        </button>
                                        <button
                                            className={`chip ${notifyProjectReminders ? 'active' : ''}`}
                                            onClick={() => setNotifyProjectReminders(!notifyProjectReminders)}
                                        >
                                            Project reminders
                                        </button>
                                    </div>
                                </div>

                                <ReminderChannels phoneNumber={profile?.phone_number || ''} />

                                {whatsappAvailable && notifyWhatsapp && !phoneNumber && (
                                    <div className="notice warning">
                                        <WhatsappLogo size={16} weight="bold" />
                                        Add a phone number above to receive WhatsApp alerts.
                                    </div>
                                )}

                                <div className="card-actions">
                                    <Button onClick={handleSaveNotifications} disabled={isSavingNotifications} variant="secondary">
                                        {isSavingNotifications ? 'Saving...' : 'Save preferences'}
                                    </Button>
                                </div>
                            </div></CollapsibleContent>
                        </section></Collapsible>

                        <Collapsible open onOpenChange={open => setOpenCard(open ? 'Delivery activity' : '')} asChild><section className="settings-card">
                            <CollapsibleTrigger asChild disabled><button type="button" className="card-header accordion-heading">
                                <div className="header-icon activity">
                                    <DeviceMobile size={20} weight="bold" />
                                </div>
                                <div>
                                    <h3>Delivery activity</h3>
                                    <p>Recent notification delivery status.</p>
                                </div>
                            </button></CollapsibleTrigger>
                            <CollapsibleContent asChild><div className="card-content">
                                {deliveryLogs.length === 0 ? (
                                    <div className="empty-log">No delivery activity yet.</div>
                                ) : (
                                    <div className="delivery-list">
                                        {deliveryLogs.map((delivery) => (
                                            <div key={delivery.id} className="delivery-row">
                                                <div>
                                                    <div className="delivery-title">{delivery.template_key.replace('_', ' ')}</div>
                                                    <div className="delivery-meta">{formatDeliveryTime(delivery.created_at)}</div>
                                                </div>
                                                <div className={`status-pill ${delivery.status}`}>
                                                    {delivery.status}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div></CollapsibleContent>
                        </section></Collapsible>
                    </TabsContent>

                    {/* Password Section */}
                    {groupRow('security', 'Security', Lock)}<TabsContent {...groupProps('security')} value="security" className="settings-panel"><Collapsible open onOpenChange={open => setOpenCard(open ? 'Security' : '')} asChild><section className="settings-card" id="security">
                        <CollapsibleTrigger asChild disabled><button type="button" className="card-header accordion-heading">
                            <div className="header-icon security">
                                <Lock size={20} weight="bold" />
                            </div>
                            <div>
                                <h3>Security</h3>
                                <p>Update your password.</p>
                            </div>
                        </button></CollapsibleTrigger>
                        <CollapsibleContent asChild><div className="card-content">
                            <form onSubmit={handleChangePassword}>
                                <div className="form-row">
                                    <Field className="form-group">
                                        <FieldLabel htmlFor="new-password">New password</FieldLabel>
                                        <div className="input-box">
                                            <Input id="new-password"
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="Enter new password"
                                                minLength={8}
                                            />
                                        </div>
                                    </Field>
                                    <Field className="form-group">
                                        <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                                        <div className="input-box">
                                            <Input id="confirm-password"
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm new password"
                                                minLength={8}
                                            />
                                        </div>
                                    </Field>
                                </div>
                                <div className="card-actions">
                                    <Button
                                        type="submit"
                                        disabled={isChangingPassword || !newPassword || !confirmPassword}
                                        variant="secondary"
                                    >
                                        {isChangingPassword ? 'Updating...' : 'Update password'}
                                    </Button>
                                </div>
                            </form>
                        </div></CollapsibleContent>
                    </section></Collapsible>

                    {/* Danger zone */}
                    <Collapsible open onOpenChange={open => setOpenCard(open ? 'Danger zone' : '')} asChild><section className="settings-card danger">
                        <CollapsibleTrigger asChild disabled><button type="button" className="card-header accordion-heading">
                            <div className="header-icon danger">
                                <WarningCircle size={20} weight="bold" />
                            </div>
                            <div>
                                <h3>Danger zone</h3>
                                <p>Irreversible account actions.</p>
                            </div>
                        </button></CollapsibleTrigger>
                        <CollapsibleContent asChild><div className="card-content">
                            <div className="danger-row">
                                <div>
                                    <h4>Delete account</h4>
                                    <p>Permanently delete your account and all data.</p>
                                </div>
                                <Link href="/delete-account" className="request-delete-link">
                                    Request deletion
                                    <CaretRight size={15} weight="bold" />
                                </Link>
                            </div>
                        </div></CollapsibleContent>
                    </section></Collapsible></TabsContent>
                    </div>
                </Tabs>
            </div>

            <style jsx>{`
                .accordion-heading { width: 100%; text-align: left; font: inherit; color: inherit; background: transparent; border: 0; }
                .accordion-heading:disabled { opacity: 1; cursor: default; }
                .settings-container {
                    max-width: 1240px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    padding: 28px 24px 72px;
                }

                .settings-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 24px;
                    padding-bottom: 22px;
                    border-bottom: 1px solid #d8e0eb;
                }

                .settings-header h1 {
                    font-size: 2rem;
                    font-weight: 760;
                    color: #0b1f3b;
                    margin: 0;
                    letter-spacing: 0;
                }

                .settings-header p {
                    color: #64748b;
                    margin: 7px 0 0;
                    max-width: 650px;
                    font-size: 0.95rem;
                    line-height: 1.55;
                }

                .settings-status {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 9px 11px;
                    border: 1px solid #d8e0eb;
                    border-radius: 7px;
                    background: #fff;
                    white-space: nowrap;
                }

                .settings-status span {
                    color: #64748b;
                    font-size: 0.75rem;
                }

                .settings-status strong {
                    color: #0b1f3b;
                    font-size: 0.78rem;
                    text-transform: none;
                }

                :global(.settings-container .settings-layout) {
                    display: grid;
                    grid-template-columns: 218px minmax(0, 1fr);
                    gap: 24px;
                    align-items: start;
                }

                .settings-sidebar {
                    position: sticky;
                    top: 88px;
                    min-width: 0;
                    padding: 14px;
                    border: 1px solid #d8e0eb;
                    border-radius: 8px;
                    background: #fff;
                }

                .account-summary {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                    padding: 2px 2px 14px;
                    border-bottom: 1px solid #e6ebf2;
                }

                .account-avatar {
                    width: 38px;
                    height: 38px;
                    flex: 0 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 7px;
                    color: #fff;
                    background: #0b1f3b;
                }

                .account-summary > div:last-child {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .account-summary strong,
                .account-summary span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .account-summary strong { color: #0f172a; font-size: 0.79rem; }
                .account-summary span { color: #64748b; font-size: 12px; }

                :global(.settings-container .settings-nav) {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    margin-top: 10px;
                }

                :global(.settings-container .settings-nav a) {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    min-height: 38px;
                    padding: 8px 9px;
                    border-radius: 6px;
                    color: #526176;
                    font-size: 0.78rem;
                    font-weight: 620;
                    text-decoration: none;
                    transition: none;
                }
                @media (hover: hover) and (pointer: fine) {
                    .settings-nav a:hover,
                .settings-nav a:focus-visible {
                        color: #0b1f3b;
                        background: #edf2f7;
                }
                }

                .settings-nav a:focus-visible {
                    outline: 2px solid #2563eb;
                    outline-offset: 1px;
                }

                .settings-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    min-width: 0;
                }

                .split-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 18px;
                    align-items: stretch;
                }

                .settings-card {
                    background: #ffffff;
                    border-radius: 8px;
                    border: 1px solid #d8e0eb;
                    overflow: hidden;
                    scroll-margin-top: 88px;
                }

                .card-header {
                    padding: 18px 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    border-bottom: 1px solid #e6ebf2;
                    background: #fbfcfe;
                }

                .header-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 7px;
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
                .header-icon.notification { background: #eff6ff; color: #2563eb; }
                .header-icon.activity { background: #ecfeff; color: #0ea5e9; }

                .card-header h3 {
                    margin: 0;
                    font-size: 0.98rem;
                    font-weight: 700;
                    color: #0f172a;
                }

                .card-header p {
                    margin: 2px 0 0;
                    font-size: 0.78rem;
                    color: #64748b;
                }

                .card-content {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }

                :global(.settings-container .form-group) {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                :global(.settings-container .form-group label) {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #475569;
                    text-transform: none;
                    letter-spacing: 0;
                }

                .input-box {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 7px;
                    background: #ffffff;
                    transition: none;
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

                :global(.settings-container .input-box input) {
                    border: none;
                    outline: none;
                    /* min-width:0 lets the field shrink inside the flex row.
                       Without it the input keeps its default intrinsic width and
                       pushes against the Verified badge, which clipped longer
                       addresses — builder@zimestimate.test rendered as
                       "builder@zimestimate". */
                    width: 100%;
                    min-width: 0;
                    font-size: 0.95rem;
                    color: #0f172a;
                    background: transparent;
                    text-overflow: ellipsis;
                }

                :global(.settings-container .input-box input:disabled) {
                    color: #64748b;
                    cursor: not-allowed;
                }

                .field-hint {
                    margin: 8px 0 0;
                    font-size: 0.8rem;
                    color: #64748b;
                    line-height: 1.45;
                }

                .field-note {
                    margin: 8px 0 0;
                    font-size: 0.8rem;
                    line-height: 1.5;
                    color: var(--color-text-secondary);
                }

                .text-link {
                    padding: 0;
                    border: none;
                    background: none;
                    color: var(--color-accent);
                    font: inherit;
                    font-weight: 600;
                    text-decoration: underline;
                    cursor: pointer;
                }

                .email-change {
                    display: grid;
                    gap: 8px;
                    margin-top: 10px;
                }

                .email-change-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }

                .badge {
                    font-size: 12px;
                    font-weight: 600;
                    color: #166534;
                    background: #dcfce7;
                    padding: 2px 8px;
                    border-radius: 4px;
                    text-transform: none;
                    margin-left: auto;
                    flex-shrink: 0;
                }

                .card-actions {
                    display: flex;
                    justify-content: flex-end;
                    padding-top: 8px;
                }

                .toggle-group {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .toggle-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .toggle-label {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #0f172a;
                    display: block;
                }

                .toggle-hint {
                    font-size: 0.8rem;
                    color: #64748b;
                }

                .notification-section {
                    border-top: 1px solid #f1f5f9;
                    padding-top: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .section-title {
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: none;
                    letter-spacing: 0.02em;
                    color: #64748b;
                }

                .chip-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }

                .chip {
                    border: 1px solid #e2e8f0;
                    background: #f8fafc;
                    color: #475569;
                    font-size: 0.85rem;
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: none;
                }

                .chip.active {
                    background: #2563eb;
                    border-color: #2563eb;
                    color: #ffffff;
                }

                .notice {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 12px;
                    border-radius: 7px;
                    font-size: 0.85rem;
                }

                .notice.warning {
                    background: #fff7ed;
                    color: #c2410c;
                }

                .delivery-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .delivery-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .delivery-title {
                    font-weight: 600;
                    text-transform: capitalize;
                }

                .delivery-meta {
                    font-size: 0.8rem;
                    color: #64748b;
                }

                .status-pill {
                    padding: 4px 10px;
                    border-radius: 999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: none;
                    background: #e2e8f0;
                    color: #475569;
                }

                .status-pill.sent {
                    background: #dcfce7;
                    color: #166534;
                }

                .status-pill.failed {
                    background: #fee2e2;
                    color: #b91c1c;
                }

                .empty-log {
                    color: var(--color-text-secondary);
                    font-size: 0.9rem;
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
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: none;
                }

                .plan-badge.free { background: #f1f5f9; color: var(--color-text); }
                .plan-badge.pro { background: #eff6ff; color: #2563eb; }
                .plan-badge.admin { background: #fefce8; color: #b45309; }

                .plan-description {
                    font-size: 0.9rem;
                    color: #64748b;
                    line-height: 1.5;
                    margin: 0;
                }

                :global(.settings-container .upgrade-link) {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #2563eb;
                    text-decoration: none;
                    margin-top: 4px;
                }
                @media (hover: hover) and (pointer: fine) {
                    :global(.settings-container .upgrade-link:hover) {
                        text-decoration: underline;
                }
                }

                /* Danger zone */
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

                :global(.request-delete-link) {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 9px 11px;
                    border: 1px solid #fecaca;
                    border-radius: 6px;
                    color: #b91c1c;
                    background: #fff;
                    font-size: 0.8rem;
                    font-weight: 650;
                    text-decoration: none;
                }
                @media (hover: hover) and (pointer: fine) {
                    :global(.request-delete-link:hover) {
                        background: #fef2f2;
                }
                }

                @media (max-width: 900px) {
                    .settings-container {
                        padding: 22px 16px 96px;
                    }

                    :global(.settings-container .settings-layout) {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }

                    .settings-sidebar {
                        position: static;
                        padding: 10px;
                    }

                    .account-summary {
                        display: none;
                    }

                    :global(.settings-container .settings-nav) {
                        flex-direction: row;
                        /* shadcn centres its tab list; centred and scrolling sideways, the
                           first tabs sat past the left edge where scrolling cannot reach. */
                        justify-content: flex-start;
                        gap: 5px;
                        margin: 0;
                        overflow-x: auto;
                        scrollbar-width: none;
                    }

                    .settings-nav::-webkit-scrollbar {
                        display: none;
                    }

                    :global(.settings-container .settings-nav a) {
                        flex: 0 0 auto;
                        min-height: 36px;
                    }
                }

                @media (max-width: 768px) {
                    .settings-header {
                        align-items: flex-start;
                    }

                    .settings-header h1 {
                        font-size: 1.7rem;
                    }

                    .settings-status {
                        padding: 7px 9px;
                    }

                    .split-grid, .form-row {
                        grid-template-columns: 1fr;
                    }

                    /* At 375px the row is icon + value + Verified badge, which
                       left ~150px for the address and clipped anything longer —
                       builder@zimestimate.test showed as "builder@zimestimate".
                       Tightening the row and the value recovers the ~30px the
                       full address needs. */
                    .input-box {
                        gap: 8px;
                        padding: 12px 10px;
                    }

                    :global(.settings-container .input-box input) {
                        font-size: 0.85rem;
                    }

                    .badge {
                        font-size: 12px;
                        padding: 2px 6px;
                    }

                    .danger-row {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 16px;
                    }

                    .danger-row button {
                        width: 100%;
                    }

                    :global(.request-delete-link) {
                        justify-content: center;
                        width: 100%;
                    }
                }

                @media (max-width: 640px) {
                    .settings-container {
                        margin-inline: -8px;
                        padding-inline: 0;
                    }

                    .settings-header { border-bottom-color: var(--color-primary-light); }
                    .settings-header h1 { color: white; }
                    .settings-header p { color: var(--color-muted-on-navy); }
                }

                @media (max-width: 480px) {
                    .settings-container {
                        padding-block: 18px 96px;
                    }

                    .settings-header {
                        flex-direction: column;
                        gap: 14px;
                    }

                    .settings-status {
                        align-self: flex-start;
                    }

                    .card-header,
                    .card-content {
                        padding-left: 16px;
                        padding-right: 16px;
                    }

                    .card-actions :global(button) {
                        width: 100%;
                    }

                    .toggle-hint {
                        display: block;
                        max-width: 210px;
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

                @media (prefers-reduced-motion: reduce) {
                    @keyframes spin { from { opacity: .5; } to { opacity: 1; } }
                }
                :global(.settings-container .settings-layout) { display: grid; }
                :global(.settings-container .settings-nav) { display: flex; flex-direction: column; align-items: stretch; width: 100%; height: auto; background: var(--color-surface); }
                :global(.settings-container .settings-nav [data-slot="tabs-trigger"]) { min-height: 44px; justify-content: flex-start; padding: 8px 10px; color: var(--color-text); }
                :global(.settings-container .settings-nav [data-state="active"]) { color: var(--color-text); background: var(--color-background); }
                :global(.settings-container .input-box input) { min-height: 44px; height: 44px; padding: 0; box-shadow: none; transition: none; opacity: 1; }
                .input-box { padding-block: 0; }
                :global(.settings-container .form-group label) { color: var(--color-text-secondary); font-size: 12px; }
                .text-link, .chip { min-height: 44px; }
                :global(.settings-container .upgrade-link), :global(.settings-container .request-delete-link) { min-height: 44px; }
                :global(.settings-container .upgrade-link) { white-space: nowrap; }
                :global(.settings-container .upgrade-link svg) { flex-shrink: 0; }
                .currency-note { margin: 0; color: var(--color-text-secondary); }
                .split-grid { display: contents; }
                :global(.settings-container .settings-panel[data-state="active"]) { display: flex; flex-direction: column; gap: 18px; }
                @media (max-width: 900px) {
                    :global(.settings-container .settings-nav) { flex-direction: row; overflow-x: auto; }
                    :global(.settings-container .settings-nav [data-slot="tabs-trigger"]) { flex: 0 0 auto; }
                }
                @media (max-width: 767px) {
                    .settings-container { gap: 16px; }
                    .settings-header { flex-direction: row; align-items: center; gap: 12px; padding-bottom: 0; border-bottom: 0; }
                    .settings-status { align-self: center; }
                    .settings-status span { display: none; }
                    .settings-status strong { color: var(--color-selected-ink); }
                    .settings-status { background: var(--color-selected-surface); border-color: transparent; border-radius: 999px; }
                    .settings-sidebar { padding: 16px; border-radius: 12px; }
                    .account-summary { display: flex; padding: 0; border: 0; gap: 12px; }
                    .account-summary strong { font-size: 0.95rem; }
                    .account-summary span { font-size: 0.82rem; }
                    .account-avatar { width: 44px; height: 44px; border-radius: 12px; }
                    :global(.settings-container .settings-nav) { display: none; }
                    .settings-grid { gap: 8px; }
                    :global(.settings-container [data-slot="tabs-content"][hidden]) { display: none; }
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
