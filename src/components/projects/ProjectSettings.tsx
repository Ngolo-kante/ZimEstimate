'use client';

import { useEffect, useState, useCallback } from 'react';
import { Project, BOQCategory } from '@/lib/database.types';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateProject } from '@/lib/services/projects';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
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
    Gear,
    PaperPlaneTilt,
    Package,
    CurrencyDollar,
    TrendUp,
    ListChecks,
    CalendarCheck,
    ShieldCheck,
    CaretDown,
    CaretUp,
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
    { id: 'sms', label: 'SMS', icon: <ChatCircleText size={16} weight="duotone" /> },
    { id: 'whatsapp', label: 'WhatsApp', icon: <WhatsappLogo size={16} weight="duotone" /> },
    { id: 'telegram', label: 'Telegram', icon: <PaperPlaneTilt size={16} weight="duotone" /> },
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
        color: 'var(--color-emerald)',
        hasFrequency: true,
    },
    {
        id: 'compliance',
        icon: <ShieldCheck size={20} weight="duotone" />,
        title: 'Compliance Deadline Alerts',
        description: 'Alerts for upcoming certificate and approval deadlines.',
        color: '#7C3AED',
        hasFrequency: true,
    },
];

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
    expanded,
    onToggleExpand,
}: {
    config: AlertConfig;
    state: AlertRowState;
    onChange: (updates: Partial<AlertRowState>) => void;
    expanded: boolean;
    onToggleExpand: () => void;
}) {
    return (
        <div className={`alert-row ${state.enabled ? 'enabled' : ''}`}>
            <div
                className="alert-row-header"
                onClick={onToggleExpand}
            >
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
                <div className="alert-row-right">
                    {state.enabled && (
                        <span className="alert-active-dot" />
                    )}
                    <div
                        className={`switch-btn ${state.enabled ? 'active' : ''}`}
                        role="presentation"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange({ enabled: !state.enabled });
                        }}
                    >
                        <span className="switch-slider" />
                    </div>
                    <span className="alert-caret">
                        {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                    </span>
                </div>
            </div>

            {expanded && state.enabled && (
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
    const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set(['low_stock', 'budget_reminder']));
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

    const toggleExpand = useCallback((id: string) => {
        setExpandedAlerts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

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
                    if (isMobileChannel(selectedChannel) && !canUseMobileReminders) {
                        onRequestPhone?.({
                            channel: selectedChannel,
                            pendingReminder: { frequency: budgetState.frequency, amount },
                        });
                    } else {
                        onSetReminder?.(budgetState.frequency, amount, selectedChannel);
                    }
                }
            } else if (reminderActive) {
                // User disabled budget reminders — toggle them off
                onToggleReminder?.(false);
            }

            success('Project configurations saved');
        } catch (err) {
            showError('Failed to save changes');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const enabledCount = Object.values(alertStates).filter(s => s.enabled).length;

    return (
        <div className="settings-page">
            {/* ========== HEADER ========== */}
            <div className="settings-header">
                <div className="settings-header-content">
                    <div className="settings-header-icon">
                        <Gear size={24} weight="duotone" />
                    </div>
                    <div>
                        <h2>Project Configurations</h2>
                        <p>Manage stages, alerts, and notification preferences.</p>
                    </div>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    icon={isSaving
                        ? <div className="spinner-border animate-spin w-4 h-4 border-2 border-white rounded-full" />
                        : <FloppyDisk size={18} />
                    }
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            {/* ========== 1. GENERAL ========== */}
            <div className="settings-card">
                <div className="settings-card-header">
                    <h3>General Parameters</h3>
                    <p>Basic project information and location details.</p>
                </div>
                <div className="settings-card-content">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">Project Name</label>
                            <div className="form-input-wrapper">
                                <input
                                    className="form-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                                <HouseLine size={18} className="form-input-icon" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <div className="form-input-wrapper">
                                <input
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
            </div>

            {/* ========== 2. STAGE VISIBILITY ========== */}
            <div className="settings-card">
                <div className="settings-card-header">
                    <h3>Substage Visibility</h3>
                    <p>Toggle stages to show or hide throughout the project.</p>
                </div>
                <div className="settings-card-content">
                    {STAGE_CATEGORIES.map((stage) => {
                        const isVisible = selectedStages.includes(stage.id);
                        return (
                            <div
                                key={stage.id}
                                className={`stage-toggle-card ${isVisible ? 'active' : ''}`}
                                onClick={() => handleStageToggle(stage.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="stage-info">
                                    <div className="stage-icon">
                                        {isVisible ? <Check size={18} weight="bold" /> : <EyeSlash size={18} />}
                                    </div>
                                    <div className="stage-text">
                                        <h4>{stage.label}</h4>
                                        <p>{stage.description}</p>
                                    </div>
                                </div>
                                <div
                                    className={`switch-btn ${isVisible ? 'active' : ''}`}
                                    role="presentation"
                                >
                                    <span className="switch-slider" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ========== 3. NOTIFICATION CENTRE ========== */}
            <div className="settings-card notification-centre">
                <div className="settings-card-header">
                    <div className="notif-header-row">
                        <div>
                            <h3>
                                <BellRinging size={18} weight="duotone" style={{ marginRight: '8px', verticalAlign: '-3px' }} />
                                Notification Centre
                            </h3>
                            <p>Configure which alerts you receive and how.</p>
                        </div>
                        <div className="notif-count-badge">
                            {enabledCount} active
                        </div>
                    </div>
                </div>

                <div className="settings-card-content">
                    {/* === Preferred Channel === */}
                    <div className="notif-channel-section">
                        <label className="form-label">Preferred Notification Method</label>
                        <p className="notif-channel-desc">
                            All alerts below will be sent through your selected channel.
                        </p>
                        <div className="channel-selector">
                            {CHANNEL_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`channel-option ${selectedChannel === option.id ? 'selected' : ''}`}
                                    onClick={() => handleChannelSelect(option.id)}
                                >
                                    {option.icon}
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* === Divider === */}
                    <div className="notif-divider">
                        <span>Alert Types</span>
                    </div>

                    {/* === Alert Rows === */}
                    <div className="alert-list">
                        {ALERT_DEFINITIONS.map((config) => (
                            <AlertRow
                                key={config.id}
                                config={config}
                                state={alertStates[config.id]}
                                onChange={(updates) => updateAlertState(config.id, updates)}
                                expanded={expandedAlerts.has(config.id)}
                                onToggleExpand={() => toggleExpand(config.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
