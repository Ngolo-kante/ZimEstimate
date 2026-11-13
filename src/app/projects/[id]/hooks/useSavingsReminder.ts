'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/ui/CurrencyToggle';
import { useAuth } from '@/components/providers/AuthProvider';
import type { NotificationChannel } from '@/components/ui/BudgetPlanner';
import {
    createReminder,
    getProjectRecurringReminder,
    upsertProjectRecurringReminder,
    updateProjectRecurringReminder,
} from '@/lib/services/projects';
import type { BOQCategory, Project, ProjectRecurringReminder } from '@/lib/database.types';
import {
    STAGE_CATEGORIES,
    STAGE_LABELS as categoryLabels,
    nextReminderRunAt as getNextRunAt,
    type ReminderFrequency,
} from '@/lib/projects/workspaceStages';

type PendingReminder = { frequency: ReminderFrequency; amount: number; channel: NotificationChannel };
export type ReminderDraft = { amountUsd: number; frequency: ReminderFrequency };

/**
 * The savings reminder: which channel to send it by, the phone number needed
 * for WhatsApp or SMS, and scheduling, pausing and resuming it.
 */
export function useSavingsReminder({
    projectId,
    project,
    activeTab,
    reminderChannels,
}: {
    projectId: string;
    project: Project | null;
    activeTab: BOQCategory;
    /** What reminders can actually be sent by right now. */
    reminderChannels: NotificationChannel[];
}) {
    const { success, error: showError } = useToast();
    const { profile, updateProfile } = useAuth();
    const { exchangeRate, formatPrice } = useCurrency();

    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [pendingReminder, setPendingReminder] = useState<PendingReminder | null>(null);
    const [preferredReminderChannel, setPreferredReminderChannel] = useState<NotificationChannel>('email');
    // A saved preference for a channel that cannot send yet falls back to email.
    const activeReminderChannel: NotificationChannel = reminderChannels.includes(preferredReminderChannel) ? preferredReminderChannel : 'email';
    const [requestedChannel, setRequestedChannel] = useState<NotificationChannel | null>(null);
    const [savingsReminder, setSavingsReminder] = useState<ProjectRecurringReminder | null>(null);
    // "Remind me to save $X a week" from the Budget Planner: carried into
    // reminder setup so the amount and frequency are already filled in.
    const [reminderDraft, setReminderDraft] = useState<ReminderDraft | null>(null);

    useEffect(() => {
        if (!profile) return;
        const phoneRequired = preferredReminderChannel === 'sms' || preferredReminderChannel === 'whatsapp';
        const missingContact = phoneRequired && !profile.phone_number;

        if (missingContact) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- fall back to email without a phone number
            setPreferredReminderChannel('email');
        }
    }, [profile, preferredReminderChannel]);

    useEffect(() => {
        if (!project || !profile?.id) return;
        const loadRecurringReminder = async () => {
            const { reminder } = await getProjectRecurringReminder(project.id, profile.id, 'savings');
            setSavingsReminder(reminder);
        };
        loadRecurringReminder();
    }, [project, profile?.id]);

    const handleSavingsReminder = async (
        frequency: ReminderFrequency,
        amount: number,
        channel: NotificationChannel,
        phoneOverride?: string
    ) => {
        if (!profile?.id) {
            showError('Please sign in again to set reminders.');
            return;
        }
        if (project?.owner_id && profile?.id && project.owner_id !== profile.id) {
            showError('Only the project owner can schedule reminders.');
            return;
        }

        const isPhoneChannel = channel === 'sms' || channel === 'whatsapp';
        const effectivePhone = phoneOverride || profile?.phone_number || '';
        if (isPhoneChannel && !effectivePhone) {
            showError('Add a phone number to schedule mobile reminders.');
            return;
        }

        const firstRunAt = getNextRunAt(frequency);
        const nextRunAt = getNextRunAt(frequency, firstRunAt);
        const targetDate = project?.target_purchase_date || null;

        if (targetDate && firstRunAt.toISOString().split('T')[0] > targetDate) {
            showError('Target date is before the next reminder date. Update the target date first.');
            return;
        }

        const stageLabel = STAGE_CATEGORIES.includes(activeTab as BOQCategory)
            ? categoryLabels[activeTab as BOQCategory]
            : 'Project';

        // Prepend channel to message since DB doesn't have a channel column yet
        const message = `[${channel.toUpperCase()}] Savings reminder for ${project?.name || 'Project'} (${stageLabel}): save ${formatPrice(amount, amount * exchangeRate)} ${frequency}.`;

        const { reminder, error: recurringError } = await upsertProjectRecurringReminder({
            project_id: projectId,
            user_id: profile.id,
            reminder_type: 'savings',
            frequency,
            channel,
            amount_usd: amount,
            target_date: targetDate,
            next_run_at: nextRunAt.toISOString(),
            is_active: true,
        });

        if (recurringError) {
            showError(`Failed to save recurring reminder: ${recurringError.message}`);
            return;
        }

        setSavingsReminder(reminder);
        setPreferredReminderChannel(channel);

        const { error: reminderError } = await createReminder({
            project_id: projectId,
            reminder_type: 'savings',
            message,
            scheduled_date: firstRunAt.toISOString(),
            phone_number: effectivePhone || '0000000000', // Fallback for email-only if DB requires phone
        });

        if (reminderError) {
            showError(`Failed to schedule reminder: ${reminderError.message}`);
            return;
        }

        success(`Reminder scheduled via ${channel} for ${firstRunAt.toISOString().split('T')[0]}`);
    };

    const handleToggleSavingsReminder = async (active: boolean) => {
        if (!savingsReminder) return;
        const nextRunAt = active ? getNextRunAt(savingsReminder.frequency as ReminderFrequency) : savingsReminder.next_run_at;
        const { reminder, error } = await updateProjectRecurringReminder(savingsReminder.id, {
            is_active: active,
            next_run_at: active ? (nextRunAt instanceof Date ? nextRunAt.toISOString() : nextRunAt) : savingsReminder.next_run_at,
        });
        if (error) {
            showError('Failed to update reminder status');
            return;
        }
        setSavingsReminder(reminder);
        success(active ? 'Reminder enabled' : 'Reminder disabled');
    };

    const handleRequestPhone = (payload?: {
        channel?: NotificationChannel;
        pendingReminder?: { frequency: ReminderFrequency; amount: number };
    }) => {
        setRequestedChannel(payload?.channel ?? null);
        if (payload?.pendingReminder) {
            setPendingReminder({
                frequency: payload.pendingReminder.frequency,
                amount: payload.pendingReminder.amount,
                channel: payload.channel ?? activeReminderChannel,
            });
        }
        setShowPhoneModal(true);
    };

    const handleSavePhoneNumber = async (phoneNumber: string) => {
        const { error } = await updateProfile({ phone_number: phoneNumber });
        if (error) {
            showError('Failed to save phone number. Please try again.');
            return;
        }

        success('Phone number saved');
        setShowPhoneModal(false);

        if (requestedChannel) {
            setPreferredReminderChannel(requestedChannel);
        }

        if (pendingReminder) {
            const reminder = { ...pendingReminder, channel: requestedChannel ?? pendingReminder.channel };
            setPendingReminder(null);
            setRequestedChannel(null);
            await handleSavingsReminder(reminder.frequency, reminder.amount, reminder.channel, phoneNumber);
            return;
        }

        setRequestedChannel(null);
    };

    const closePhoneModal = () => {
        setShowPhoneModal(false);
        setPendingReminder(null);
        setRequestedChannel(null);
    };

    return {
        activeReminderChannel,
        setPreferredReminderChannel,
        savingsReminder,
        reminderDraft,
        setReminderDraft,
        showPhoneModal,
        closePhoneModal,
        handleSavingsReminder,
        handleToggleSavingsReminder,
        handleRequestPhone,
        handleSavePhoneNumber,
    };
}
