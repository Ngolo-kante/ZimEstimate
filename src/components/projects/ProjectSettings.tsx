'use client';

import { useEffect, useState, useCallback } from 'react';
import { Project, BOQCategory } from '@/lib/database.types';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateProject } from '@/lib/services/projects';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
import { useReminderChannels } from '@/hooks/useReminderChannels';
import {
    MapPin,
    HouseLine,
    FloppyDisk,
    Check,
    EyeSlash,
    BellRinging,
    ChatCircleText,
    WhatsappLogo,
    EnvelopeSimple,
    Package,
    CurrencyDollar,
    TrendUp,
    ListChecks,
    CalendarCheck,
    ShieldCheck,
    Stack,
} from '@phosphor-icons/react';

import '@/styles/project-settings.css';

/* ================ TYPES ================ */

interface ProjectSettingsProps {
    project: Project;
    onUpdate: (updatedProject: Project) => void;
    onSetReminder?: (type: ReminderFrequency, amount: number, channel: NotificationChannel) => void;
    canUseMobileReminders?: boolean;
    defaultReminderChannel?: NotificationChannel;
    onRequestPhone?: (payload?: {
        channel?: NotificationChannel;
        pendingReminder?: { frequency: ReminderFrequency; amount: number };
    }) => void;
    reminderActive?: boolean;
    reminderFrequency?: ReminderFrequency | null;
    onToggleReminder?: (active: boolean) => void;
    defaultReminderAmountUsd?: number;
    /** A savings plan from the Budget Planner, to pre-fill the budget reminder. */
    reminderDraft?: { amountUsd: number; frequency: ReminderFrequency } | null;
    onReminderDraftUsed?: () => void;
    onReminderChannelChange?: (channel: NotificationChannel) => void;
}

type ReminderFrequency = 'daily' | 'weekly' | 'monthly';

/* ================ CONSTANTS ================ */

const STAGE_CATEGORIES: { id: BOQCategory; label: string; description: string }[] = [
    { id: 'substructure', label: 'Site Preparation & Foundation', description: 'Foundation work, excavation, and footing.' },
    { id: 'superstructure', label: 'Structural Walls & Frame', description: 'Brickwork, lintels, and beams up to roof level.' },
    { id: 'roofing', label: 'Roofing', description: 'Trusses, sheets, tiles, and ceiling.' },
    { id: 'finishing', label: 'Interior & Finishing', description: 'Plastering, painting, tiling, and glazing.' },
    { id: 'exterior', label: 'External Work', description: 'Landscaping, paving, and boundary walls.' },
];

const CHANNEL_OPTIONS: { id: NotificationChannel; label: string; icon: React.ReactNode }[] = [
    { id: 'email', label: 'Email', icon: <EnvelopeSimple size={16} weight="duotone" /> },
    { id: 'whatsapp', label: 'WhatsApp', icon: <WhatsappLogo size={16} weight="duotone" /> },
    { id: 'sms', label: 'SMS', icon: <ChatCircleText size={16} weight="duotone" /> },
];

const FREQUENCY_OPTIONS: { id: ReminderFrequency; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
];

/* ================ NOTIFICATION ALERT DEFINITIONS ================ */

interface AlertConfig {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;              // CSS color for the icon badge
    hasThreshold?: boolean;     // show threshold input
    thresholdLabel?: string;
    thresholdUnit?: string;
    thresholdMin?: number;
    thresholdMax?: number;
    hasFrequency?: boolean;     // show frequency selector
    hasAmount?: boolean;        // show amount input (budget)
}

const ALERT_DEFINITIONS: AlertConfig[] = [
    {
        id: 'low_stock',
        icon: <Package size={20} weight="duotone" />,
        title: 'Low Stock Alerts',
        description: 'Get notified when remaining material drops below a set threshold.',
        color: 'var(--color-amber)',
        hasThreshold: true,
        thresholdLabel: 'Alert when stock falls below',
        thresholdUnit: '%',
        thresholdMin: 1,
        thresholdMax: 100,
    },
    {
        id: 'price_change',
        icon: <TrendUp size={20} weight="duotone" />,
        title: 'Price Change Alerts',
        description: 'Be alerted when supplier prices change significantly on your BOQ items.',
        color: 'var(--color-danger)',
        hasThreshold: true,
        thresholdLabel: 'Alert when price changes by more than',
        thresholdUnit: '%',
        thresholdMin: 1,
        thresholdMax: 100,
    },
    {
        id: 'budget_reminder',
        icon: <CurrencyDollar size={20} weight="duotone" />,
        title: 'Budget Reminders',
        description: 'Periodic reminders to help you stay on track with project savings targets.',
        color: 'var(--color-accent)',
        hasFrequency: true,
        hasAmount: true,
    },
    {
        id: 'upcoming_stage',
        icon: <CalendarCheck size={20} weight="duotone" />,
        title: 'Upcoming Stage Reminders',
        description: 'Receive reminders before a construction stage is due to begin.',
        color: 'var(--color-clay)',
        hasFrequency: true,
    },
    {
        id: 'admin_tasks',
        icon: <ListChecks size={20} weight="duotone" />,
        title: 'Admin Task Reminders',
        description: 'Regular nudges for pending admin and compliance tasks on your project.',
        color: 'var(--color-accent)',
        hasFrequency: true,
    },
    {
        id: 'compliance',
        icon: <ShieldCheck size={20} weight="duotone" />,
        title: 'Compliance Deadline Alerts',
        description: 'Alerts for upcoming certificate and approval deadlines.',
        color: 'var(--color-primary)',
        hasFrequency: true,
    },
];

/* Only alerts the app actually acts on. Price change, upcoming stage, admin
   task and compliance deadline switches were here too, but nothing saved or
   sent them — switches that did nothing. */
const WORKING_ALERTS = ALERT_DEFINITIONS.filter((alert) => alert.id === 'low_stock' || alert.id === 'budget_reminder');

/* ================ SUB-COMPONENT: AlertRow ================ */

interface AlertRowState {
    enabled: boolean;
    threshold: number;
    frequency: ReminderFrequency;
    amount: string;
}

function AlertRow({
    config,
    state,
    onChange,
}: {
    config: AlertConfig;
    state: AlertRowState;
    onChange: (updates: Partial<AlertRowState>) => void;
}) {
    return (
        <div className={`alert-row ${state.enabled ? 'enabled' : ''}`}>
            <div className="alert-row-header">
                <div className="alert-row-left">
                    <div
                        className="alert-icon-badge"
                        style={{ background: `color-mix(in srgb, ${config.color} 12%, transparent)`, color: config.color }}
                    >
                        {config.icon}
                    </div>
                    <div className="alert-row-text">
                        <h4>{config.title}</h4>
                        <p>{config.description}</p>
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={state.enabled}
                    aria-label={`${config.title}: ${state.enabled ? 'on' : 'off'}`}
                    className={`switch-btn ${state.enabled ? 'active' : ''}`}
                    onClick={() => onChange({ enabled: !state.enabled })}
                >
                    <span className="switch-slider" />
                </button>
            </div>

            {/* Settings show as soon as the alert is on — no second click. */}
            {state.enabled && (
                <div className="alert-row-body">
                    {/* Threshold input */}
                    {config.hasThreshold && (
                        <div className="alert-config-field">
                            <label className="form-label">{config.thresholdLabel}</label>
                            <div className="threshold-input-row">
                                <input
                                    className="form-input compact"
                                    type="number"
                                    min={config.thresholdMin}
                                    max={config.thresholdMax}
                                    value={state.threshold}
                                    onChange={(e) => onChange({ threshold: Number(e.target.value) })}
                                />
                                <span className="threshold-unit">{config.thresholdUnit}</span>
                            </div>
                        </div>
                    )}

                    {/* Amount input (for budget) */}
                    {config.hasAmount && (
                        <div className="alert-config-field">
                            <label className="form-label">Reminder Amount (USD)</label>
                            <div className="form-input-wrapper" style={{ maxWidth: '200px' }}>
                                <span className="currency-prefix">$</span>
                                <input
                                    className="form-input compact"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={state.amount}
                                    onChange={(e) => onChange({ amount: e.target.value })}
                                    style={{ paddingLeft: '26px' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Frequency selector */}
                    {config.hasFrequency && (
                        <div className="alert-config-field">
                            <label className="form-label">Frequency</label>
                            <div className="frequency-selector">
                                {FREQUENCY_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        className={`freq-chip ${state.frequency === opt.id ? 'selected' : ''}`}
                                        onClick={() => onChange({ frequency: opt.id })}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ================ MAIN COMPONENT ================ */

export default function ProjectSettings({
    project,
    onUpdate,
    onSetReminder,
    canUseMobileReminders = true,
    defaultReminderChannel = 'email',
    onRequestPhone,
    reminderActive = false,
    reminderFrequency = null,
    onToggleReminder,
    defaultReminderAmountUsd = 0,
    reminderDraft = null,
    onReminderDraftUsed,
    onReminderChannelChange,
}: ProjectSettingsProps) {
    const { success, error: showError } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    // --- General Settings State ---
    const [name, setName] = useState(project.name);
    const [location, setLocation] = useState(project.location || '');
    const [selectedStages, setSelectedStages] = useState<string[]>(
        project.selected_stages || STAGE_CATEGORIES.map(s => s.id)
    );

    // --- Notification Centre State ---
    const [selectedChannel, setSelectedChannel] = useState<NotificationChannel>(defaultReminderChannel);
    // Only channels that can send right now; email until WhatsApp is set up.
    const reminderChannels = useReminderChannels();
    const channelOptions = CHANNEL_OPTIONS.filter((option) => reminderChannels.includes(option.id));
    const effectiveChannel: NotificationChannel = reminderChannels.includes(selectedChannel) ? selectedChannel : 'email';
    const [alertStates, setAlertStates] = useState<Record<string, AlertRowState>>(() => ({
        low_stock: {
            enabled: project.usage_low_stock_alert_enabled ?? false,
            threshold: project.usage_low_stock_threshold ?? 20,
            frequency: 'weekly',
            amount: '0',
        },
        price_change: {
            enabled: false,
            threshold: 10,
            frequency: 'daily',
            amount: '0',
        },
        budget_reminder: {
            enabled: reminderActive,
            threshold: 0,
            frequency: reminderFrequency ?? 'weekly',
            amount: String(Math.max(defaultReminderAmountUsd, 0).toFixed(2)),
        },
        upcoming_stage: {
            enabled: false,
            threshold: 0,
            frequency: 'weekly',
            amount: '0',
        },
        admin_tasks: {
            enabled: false,
            threshold: 0,
            frequency: 'daily',
            amount: '0',
        },
        compliance: {
            enabled: false,
            threshold: 0,
            frequency: 'weekly',
            amount: '0',
        },
    }));

    useEffect(() => {
        setSelectedChannel(defaultReminderChannel);
    }, [defaultReminderChannel]);

    useEffect(() => {
        setAlertStates(prev => ({
            ...prev,
            budget_reminder: {
                ...prev.budget_reminder,
                enabled: reminderActive,
                frequency: reminderFrequency ?? prev.budget_reminder.frequency,
                amount: String(Math.max(defaultReminderAmountUsd, 0).toFixed(2)),
            },
        }));
    }, [reminderActive, reminderFrequency, defaultReminderAmountUsd]);

    // Arriving from "Remind me to save $X a week" on Budget: switch the budget
    // reminder on with that plan and bring it into view. It is saved with
    // Save changes like any other edit.
    const [draftApplied, setDraftApplied] = useState<{ amountUsd: number; frequency: ReminderFrequency } | null>(null);
    useEffect(() => {
        if (!reminderDraft) return;
        setAlertStates(prev => ({
            ...prev,
            budget_reminder: {
                ...prev.budget_reminder,
                enabled: true,
                frequency: reminderDraft.frequency,
                amount: reminderDraft.amountUsd.toFixed(2),
            },
        }));
        setDraftApplied(reminderDraft);
        onReminderDraftUsed?.();
        window.setTimeout(() => document.getElementById('settings-notifications')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }, [reminderDraft, onReminderDraftUsed]);

    // --- Handlers ---
    const handleStageToggle = (stageId: string) => {
        setSelectedStages(prev =>
            prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]
        );
    };

    const isMobileChannel = (channel: NotificationChannel) =>
        channel === 'sms' || channel === 'whatsapp';

    const handleChannelSelect = (channel: NotificationChannel) => {
        if (isMobileChannel(channel) && !canUseMobileReminders) {
            onRequestPhone?.({ channel });
            return;
        }
        setSelectedChannel(channel);
        onReminderChannelChange?.(channel);
    };

    const updateAlertState = useCallback((id: string, updates: Partial<AlertRowState>) => {
        setAlertStates(prev => ({
            ...prev,
            [id]: { ...prev[id], ...updates },
        }));
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const lowStockState = alertStates.low_stock;
            const budgetState = alertStates.budget_reminder;

            const updates = {
                name,
                location,
                scope: project.scope,
                selected_stages: selectedStages,
                usage_low_stock_alert_enabled: lowStockState.enabled,
                usage_low_stock_threshold: lowStockState.threshold,
            };

            const { project: updated, error } = await updateProject(project.id, updates);
            if (error) throw error;

            if (updated) {
                onUpdate({ ...project, ...updates });
            }

            // Handle budget reminder scheduling
            if (budgetState.enabled) {
                const amount = Number(budgetState.amount);
                if (Number.isFinite(amount) && amount > 0) {
                    if (isMobileChannel(effectiveChannel) && !canUseMobileReminders) {
                        onRequestPhone?.({
                            channel: effectiveChannel,
                            pendingReminder: { frequency: budgetState.frequency, amount },
                        });
                    } else {
                        onSetReminder?.(budgetState.frequency, amount, effectiveChannel);
                    }
                }
            } else if (reminderActive) {
                // User disabled budget reminders — toggle them off
                onToggleReminder?.(false);
            }

            setSavedSnapshot(snapshot);
            success('Project configurations saved');
        } catch (err) {
            showError('Failed to save changes');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const enabledCount = WORKING_ALERTS.filter((a) => alertStates[a.id]?.enabled).length;

    // What would be saved, to tell whether anything has changed since.
    const snapshot = JSON.stringify({
        name, location, stages: [...selectedStages].sort(),
        low: alertStates.low_stock, budget: alertStates.budget_reminder,
    });
    const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
    const isDirty = snapshot !== savedSnapshot;

    return (
        <div className="settings-page">
            {/* Every section is open: collapsed, the settings looked like they
                were not there. */}

            {/* ========== 1. GENERAL ========== */}
            <section className="settings-card">
                <header className="settings-card-header">
                    <span className="settings-card-icon"><HouseLine size={18} weight="duotone" /></span>
                    <span><h3>General</h3><p>Project name and location.</p></span>
                </header>
                <div className="settings-card-content">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label" htmlFor="settings-name">Project name</label>
                            <div className="form-input-wrapper">
                                <input
                                    id="settings-name"
                                    className="form-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                                <HouseLine size={18} className="form-input-icon" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="settings-location">Location</label>
                            <div className="form-input-wrapper">
                                <input
                                    id="settings-location"
                                    className="form-input"
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Borrowdale, Harare"
                                />
                                <MapPin size={18} className="form-input-icon" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== 2. STAGE VISIBILITY ========== */}
            <section className="settings-card">
                <header className="settings-card-header">
                    <span className="settings-card-icon"><Stack size={18} weight="duotone" /></span>
                    <span><h3>Project stages</h3><p>{selectedStages.length} of {STAGE_CATEGORIES.length} stages shown in this project. Turn off the ones you are not building.</p></span>
                </header>
                <div className="settings-card-content stage-grid">
                    {STAGE_CATEGORIES.map((stage) => {
                        const isVisible = selectedStages.includes(stage.id);
                        return (
                            <button
                                key={stage.id}
                                type="button"
                                role="switch"
                                aria-checked={isVisible}
                                className={`stage-toggle-card ${isVisible ? 'active' : ''}`}
                                onClick={() => handleStageToggle(stage.id)}
                            >
                                <span className="stage-info">
                                    <span className="stage-icon">
                                        {isVisible ? <Check size={16} weight="bold" /> : <EyeSlash size={16} />}
                                    </span>
                                    <span className="stage-text">
                                        <h4>{stage.label}</h4>
                                        <p>{stage.description}</p>
                                    </span>
                                </span>
                                <span className={`switch-btn ${isVisible ? 'active' : ''}`} aria-hidden="true">
                                    <span className="switch-slider" />
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* ========== 3. NOTIFICATIONS ========== */}
            <section className="settings-card notification-centre" id="settings-notifications">
                <header className="settings-card-header">
                    <span className="settings-card-icon"><BellRinging size={18} weight="duotone" /></span>
                    <span><h3>Notifications</h3><p>Alerts for this project, and how they reach you.</p></span>
                    <span className="notif-count-badge">{enabledCount} on</span>
                </header>

                <div className="settings-card-content">
                    <div className="notif-channel-section">
                        <label className="form-label">How alerts reach you</label>
                        {channelOptions.length > 1 ? (
                            <div className="channel-selector">
                                {channelOptions.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`channel-option ${effectiveChannel === option.id ? 'selected' : ''}`}
                                        onClick={() => handleChannelSelect(option.id)}
                                    >
                                        {option.icon}
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="notif-channel-desc">By email, and in the bell at the top of the page.</p>
                        )}
                    </div>

                    {draftApplied && (
                        <p className="notif-draft">
                            Budget reminder set up from your savings plan. Press <strong>Save changes</strong> to start it.
                        </p>
                    )}

                    <div className="alert-list">
                        {WORKING_ALERTS.map((config) => (
                            <AlertRow
                                key={config.id}
                                config={config}
                                state={alertStates[config.id]}
                                onChange={(updates) => updateAlertState(config.id, updates)}
                            />
                        ))}
                    </div>

                    <p className="notif-footnote">
                        Price updates on your BOQ show in your notifications automatically. To be reminded about
                        a permit or inspection, set a reminder on that task in the Compliance Tracker.
                    </p>
                </div>
            </section>

            {/* Always in reach at the bottom, and says when something is unsaved. */}
            <div className={`settings-savebar ${isDirty ? 'dirty' : ''}`}>
                <span>{isDirty ? 'You have unsaved changes' : 'All changes saved'}</span>
                <Button
                    onClick={handleSave}
                    disabled={isSaving || !isDirty}
                    icon={isSaving
                        ? <div className="spinner-border animate-spin w-4 h-4 border-2 border-white rounded-full" />
                        : <FloppyDisk size={18} />
                    }
                >
                    {isSaving ? 'Saving...' : 'Save changes'}
                </Button>
            </div>
        </div>
    );
}
